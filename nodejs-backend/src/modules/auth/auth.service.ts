import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../config/db';
import { effectivePrivileges, twoFactorRequired } from '../access/access.service';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import {
  createChallenge,
  logAuthEvent,
  resendChallenge,
  revokeSession,
  startSession,
  verifyChallenge,
  type ClientInfo,
} from './session.service';
import type {
  LoginInput,
  CreateUserInput,
  UpdateUserInput,
  UsersReadInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  UpdateUserStatusInput,
  ArchiveUsersInput,
} from './auth.schema';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface UserRow {
  UserID: number;
  UserEmail: string;
  UserName: string;
  UserPassword: string;
  RoleID: number;
  SecondaryRoleID: number | null;
  UserStatus: number;
  IsUserArchived: number;
  EmployeeID: string | null;
  ReportingManagerID: number | null;
  ELManagerID: number | null;
  AppraisalCycle: string | null;
  UserCreateTime?: Date | string | null;
}

// ─────────────────────────────────────────────────────────────
// Helper: sign a JWT for a user row, bound to a server-side session (sid).
// The token lives exactly as long as its session; every request re-checks the session.
// ─────────────────────────────────────────────────────────────
function signToken(user: UserRow, sessionId: string, expiresInSeconds: number): string {
  return jwt.sign(
    {
      sub: String(user.UserID),
      email: user.UserEmail,
      username: user.UserName,
      role: user.RoleID,
      sid: sessionId,
    },
    env.JWT_SECRET,
    { expiresIn: expiresInSeconds },
  );
}

// ─────────────────────────────────────────────────────────────
// Session payload — mirrors Java JwtUserService.authenticationLog().
// The frontend stores this object verbatim as `authUserLD`, so it is
// returned flat (not wrapped in { success, response }).
// Role 3 = Executive Leader, role 4 = Functional/Reporting Leader.
// ─────────────────────────────────────────────────────────────
const USER_SELECT = `
  SELECT UserID, UserEmail, UserName, UserPassword, RoleID, SecondaryRoleID,
         UserStatus, IsUserArchived, EmployeeID, ReportingManagerID,
         ELManagerID, AppraisalCycle, FeedbackResolverTeam, ThemePreference, TwoFactor, UserCreateTime
  FROM Users`;

interface SessionDepartment {
  departmentID: number;
  departmentName: string;
  executiveLeaderID: number | null;
  functionalLeaderID: number | null;
}

async function departmentsWhereLeader(column: 'ExecutiveLeaderID' | 'FunctionalLeaderID', userId: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT DepartmentID, DepartmentName, ExecutiveLeaderID, FunctionalLeaderID
     FROM Department
     WHERE ${column} = ? AND IsDepartmentArchived = 0 AND DepartmentStatus = 1`,
    [userId],
  );
  return rows.map((r): SessionDepartment => ({
    departmentID: r['DepartmentID'] as number,
    departmentName: r['DepartmentName'] as string,
    executiveLeaderID: (r['ExecutiveLeaderID'] as number | null) ?? null,
    functionalLeaderID: (r['FunctionalLeaderID'] as number | null) ?? null,
  }));
}

async function departmentsOfMember(userId: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT d.DepartmentID, d.DepartmentName
     FROM DepartmentUser du
     JOIN Department d ON d.DepartmentID = du.DepartmentID
     WHERE du.UserID = ? AND d.IsDepartmentArchived = 0 AND d.DepartmentStatus = 1`,
    [userId],
  );
  return rows.map((r) => ({ departmentID: r['DepartmentID'] as number, departmentName: r['DepartmentName'] as string }));
}

type SessionUser = UserRow & { FeedbackResolverTeam?: string | null; ThemePreference?: string | null; TwoFactor?: number | null };

async function buildSessionPayload(user: SessionUser, token: string) {
  const session: Record<string, unknown> = {
    username: user.UserEmail,
    name: user.UserName,
    token,
    userID: user.UserID,
    userRole: user.RoleID,
    secondaryRoleID: user.SecondaryRoleID ?? null,
    reportingManagerID: user.ReportingManagerID ?? null,
    elManagerID: user.ELManagerID ?? null,
    feedbackresolverteam: user.FeedbackResolverTeam ?? null,
    isHeExecutiveLeader: false,
    isHeFunctionalLeader: false,
    // Node-only extras kept for callers written against the earlier Node shape
    userName: user.UserName,
    userEmail: user.UserEmail,
    employeeID: user.EmployeeID,
    // Joining date: Onboarding Experience is shown to new joiners for their first 45 days
    joinedAt: user.UserCreateTime ?? null,
    // Saved Dark / Light choice; null until the user picks one at first sign-in (AUTH-11)
    themePreference: user.ThemePreference ?? null,
  };

  if (user.RoleID === 3) {
    const departments = await departmentsWhereLeader('ExecutiveLeaderID', user.UserID);
    const seen = new Set(departments.map((d) => d.departmentID));
    // An EL who also works in a department (demo data) keeps that department, as Functional Leaders do
    for (const d of await departmentsOfMember(user.UserID)) {
      if (!seen.has(d.departmentID)) departments.push({ ...d, executiveLeaderID: null, functionalLeaderID: null });
    }
    session['departments'] = departments;
    session['isHeExecutiveLeader'] = true;
  } else if (user.RoleID === 4) {
    const departments = await departmentsWhereLeader('FunctionalLeaderID', user.UserID);
    const seen = new Set(departments.map((d) => d.departmentID));
    for (const d of await departmentsOfMember(user.UserID)) {
      if (seen.has(d.departmentID)) continue;
      departments.push({ ...d, executiveLeaderID: null, functionalLeaderID: null });
      seen.add(d.departmentID);
    }
    session['departments'] = departments;
    session['isHeFunctionalLeader'] = true;
  } else {
    const [first] = await departmentsOfMember(user.UserID);
    if (first) {
      session['departmentID'] = first.departmentID;
      session['departmentName'] = first.departmentName;
    }
  }

  // What this person can open: role + department + own access (the menu and route guards use it)
  session['permissions'] = await effectivePrivileges(user.UserID);

  return session;
}

// ─────────────────────────────────────────────────────────────
// POST /authenticate — step 1 of sign-in: the password. A correct password emails a
// 6-digit code and returns { otpRequired, challengeId, … }; no session exists until the
// code is verified (AUTH-06). Like Java, a failed login is a 200 with
// { status: false, statusCode: 401 } — and the same message for an unknown email or a
// wrong password, so the response doesn't reveal which accounts exist.
// ─────────────────────────────────────────────────────────────
export async function login(input: LoginInput, client: ClientInfo) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `${USER_SELECT}
     WHERE (UserEmail = ? OR UserName = ?)
       AND IsUserArchived = 0
     LIMIT 1`,
    [input.username, input.username],
  );

  const failed = (authorization: string) => ({ authorization, status: false, statusCode: 401 });

  const user = rows[0] as SessionUser | undefined;
  if (!user) {
    await logAuthEvent('PASSWORD_FAIL', { email: input.username }, client);
    return failed('Wrong Credentials');
  }
  const match = await bcrypt.compare(input.password, user.UserPassword);
  if (!match) {
    await logAuthEvent('PASSWORD_FAIL', { userId: user.UserID, email: user.UserEmail }, client);
    return failed('Wrong Credentials');
  }
  if (user.UserStatus !== 1) return failed('Account is inactive');

  await logAuthEvent('PASSWORD_OK', { userId: user.UserID, email: user.UserEmail }, client);

  // Two-factor can be off for everyone or for this person (Access Management → Security)
  if (!(await twoFactorRequired(user))) {
    const keepSignedIn = input.keepSignedIn === true;
    const { sessionId, expiresInSeconds } = await startSession(user.UserID, keepSignedIn, client);
    const session = await buildSessionPayload(user, signToken(user, sessionId, expiresInSeconds));
    return { ...session, keepSignedIn, otpRequired: false, status: true, statusCode: 200 };
  }

  const challenge = await createChallenge(user, input.keepSignedIn === true);
  await logAuthEvent('OTP_SENT', { userId: user.UserID, email: user.UserEmail }, client);
  return { status: true, statusCode: 200, otpRequired: true, ...challenge };
}

// ─────────────────────────────────────────────────────────────
// POST /authenticate/verify-otp — step 2: the emailed code. Starts the session (ending any
// session on another device) and returns the session payload the frontend stores.
// ─────────────────────────────────────────────────────────────
export async function verifyOtp(input: { challengeId: string; code: string }, client: ClientInfo) {
  const { userId, keepSignedIn } = await verifyChallenge(input.challengeId, input.code, client);
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(`${USER_SELECT} WHERE UserID = ? LIMIT 1`, [userId]);
  const user = rows[0] as SessionUser | undefined;
  if (!user || user.UserStatus !== 1 || user.IsUserArchived) throw AppError.unauthorized('Account is inactive');

  const { sessionId, expiresInSeconds } = await startSession(user.UserID, keepSignedIn, client);
  await logAuthEvent('OTP_OK', { userId: user.UserID, email: user.UserEmail }, client, sessionId);
  const session = await buildSessionPayload(user, signToken(user, sessionId, expiresInSeconds));
  return { ...session, keepSignedIn, status: true, statusCode: 200 };
}

export async function resendOtp(input: { challengeId: string }, client: ClientInfo) {
  return { status: true, statusCode: 200, ...(await resendChallenge(input.challengeId, client)) };
}

/** POST /logout — ends the session on the server, so its token stops working everywhere (AUTH-04) */
export async function logout(user: { sub: string; sid?: string }, client: ClientInfo) {
  if (user.sid) await revokeSession(user.sid, 'LOGOUT', { userId: Number(user.sub) }, client);
  return { status: true, statusCode: 200, message: 'Signed out' };
}

/** PUT /user/theme — the Dark / Light choice follows the user to every device (AUTH-11, THEME-02) */
export async function saveTheme(userId: number, theme: 'dark' | 'light') {
  await pool.execute('UPDATE Users SET ThemePreference = ? WHERE UserID = ?', [theme, userId]);
  return { status: true, statusCode: 200, themePreference: theme };
}

// ─────────────────────────────────────────────────────────────
// GET /AMRole/:roleId  — mirrors Java AMRoleController.getRoleById().
// rolePrivileges stays the raw JSON string: the frontend JSON.parse()s it.
// ─────────────────────────────────────────────────────────────
export async function getRole(roleId: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT RoleID, RoleName, RoleDescription, RolePrivileges
     FROM AMRole WHERE RoleID = ? AND IsRoleArchived = 0 LIMIT 1`,
    [roleId],
  );
  const role = rows[0];
  if (!role) return { status: false, statusCode: 404, message: 'Role not found' };

  return {
    status: true,
    statusCode: 200,
    message: 'Role fetched successfully',
    response: {
      roleId: role['RoleID'] as number,
      roleName: role['RoleName'] as string,
      roleDescription: (role['RoleDescription'] as string | null) ?? null,
      rolePrivileges: (role['RolePrivileges'] as string | null) ?? null,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// POST /User/create
// ─────────────────────────────────────────────────────────────
export async function createUser(input: CreateUserInput, createdBy: number) {
  // Check duplicate email
  const [dup] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT UserID FROM Users WHERE UserEmail = ? LIMIT 1',
    [input.userEmail],
  );
  if ((dup as mysql.RowDataPacket[]).length > 0) throw AppError.conflict('Email already in use');

  const hashed = await bcrypt.hash(input.password, 12);

  const [result] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO Users
       (UserEmail, UserName, UserPassword, RoleID, SecondaryRoleID,
        UserStatus, IsUserArchived, EmployeeID, ReportingManagerID,
        ELManagerID, AppraisalCycle, FeedbackResolverTeam)
     VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?)`,
    [
      input.userEmail,
      input.userName,
      hashed,
      input.roleID,
      input.secondaryRoleID ?? null,
      input.employeeID ?? null,
      input.reportingManagerId ?? null,
      input.elManagerId ?? null,
      input.appraisalCycle ?? null,
      input.feedbackresolverteam ?? null,
    ],
  );

  if (input.departmentID) {
    await pool.execute(
      'INSERT IGNORE INTO DepartmentUser (DepartmentID, UserID) VALUES (?, ?)',
      [input.departmentID, result.insertId],
    );
  }

  void createdBy; // audit log can be added later

  return { userID: result.insertId, message: 'User created successfully' };
}

// ─────────────────────────────────────────────────────────────
// PUT /User/update
// ─────────────────────────────────────────────────────────────
export async function updateUser(input: UpdateUserInput) {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.userEmail !== undefined) { fields.push('UserEmail = ?'); values.push(input.userEmail); }
  if (input.userName !== undefined) { fields.push('UserName = ?'); values.push(input.userName); }
  if (input.roleID !== undefined) { fields.push('RoleID = ?'); values.push(input.roleID); }
  if (input.secondaryRoleID !== undefined) { fields.push('SecondaryRoleID = ?'); values.push(input.secondaryRoleID); }
  if (input.employeeID !== undefined) { fields.push('EmployeeID = ?'); values.push(input.employeeID); }
  if (input.reportingManagerId !== undefined) { fields.push('ReportingManagerID = ?'); values.push(input.reportingManagerId); }
  if (input.elManagerId !== undefined) { fields.push('ELManagerID = ?'); values.push(input.elManagerId); }
  if (input.appraisalCycle !== undefined) { fields.push('AppraisalCycle = ?'); values.push(input.appraisalCycle); }
  if (input.feedbackresolverteam !== undefined) { fields.push('FeedbackResolverTeam = ?'); values.push(input.feedbackresolverteam); }

  if (fields.length > 0) {
    values.push(input.userID);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await pool.execute(`UPDATE Users SET ${fields.join(', ')} WHERE UserID = ?`, values as any);
  }

  if (input.departmentID !== undefined && input.departmentID !== null) {
    await pool.execute('DELETE FROM DepartmentUser WHERE UserID = ?', [input.userID]);
    await pool.execute(
      'INSERT IGNORE INTO DepartmentUser (DepartmentID, UserID) VALUES (?, ?)',
      [input.departmentID, input.userID],
    );
  }

  return { message: 'User updated successfully' };
}

// ─────────────────────────────────────────────────────────────
// POST /users/read
// ─────────────────────────────────────────────────────────────
export async function getUsers(input: UsersReadInput) {
  const conditions: string[] = ['u.IsUserArchived = 0'];
  const params: (string | number)[] = [];

  if (input.searchText) {
    conditions.push('(u.UserName LIKE ? OR u.UserEmail LIKE ? OR u.EmployeeID LIKE ?)');
    const like = `%${input.searchText}%`;
    params.push(like, like, like);
  }
  if (input.roleID) {
    conditions.push('u.RoleID = ?');
    params.push(input.roleID);
  }
  if (input.departmentID) {
    conditions.push('du.DepartmentID = ?');
    params.push(input.departmentID);
  }
  if (input.filter === 'Active') {
    conditions.push('u.UserStatus = 1');
  } else if (input.filter === 'Inactive') {
    conditions.push('u.UserStatus = 0');
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const noLimit = !input.size;

  const [countRows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(DISTINCT u.UserID) AS total
     FROM Users u
     LEFT JOIN DepartmentUser du ON du.UserID = u.UserID
     ${where}`,
    params,
  );
  const total = (countRows[0] as { total: number }).total;

  const limitClause = noLimit ? '' : 'LIMIT ? OFFSET ?';
  const limitParams = noLimit ? [] : [input.size, Math.max(0, (input.page - 1) * input.size)];

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT DISTINCT u.UserID, u.UserEmail, u.UserName, u.RoleID, u.SecondaryRoleID,
            u.UserStatus, u.IsUserArchived, u.EmployeeID,
            u.ReportingManagerID, u.ELManagerID, u.AppraisalCycle, u.FeedbackResolverTeam,
            u.UserCreateTime,
            rm.UserName AS ReportingManagerName, elm.UserName AS ELManagerName
     FROM Users u
     LEFT JOIN DepartmentUser du ON du.UserID = u.UserID
     LEFT JOIN Users rm ON rm.UserID = u.ReportingManagerID
     LEFT JOIN Users elm ON elm.UserID = u.ELManagerID
     ${where}
     ORDER BY u.UserID DESC
     ${limitClause}`,
    [...params, ...limitParams],
  );

  const userIds = rows.map((r) => r['UserID'] as number);
  const departmentsByUser = new Map<number, { departmentID: number; departmentName: string }[]>();
  if (userIds.length > 0) {
    const [deptRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT du.UserID, d.DepartmentID, d.DepartmentName
       FROM DepartmentUser du
       JOIN Department d ON d.DepartmentID = du.DepartmentID
       WHERE du.UserID IN (${userIds.map(() => '?').join(',')})`,
      userIds,
    );
    for (const d of deptRows) {
      const uid = d['UserID'] as number;
      if (!departmentsByUser.has(uid)) departmentsByUser.set(uid, []);
      departmentsByUser.get(uid)!.push({
        departmentID: d['DepartmentID'] as number,
        departmentName: d['DepartmentName'] as string,
      });
    }
  }

  const users = rows.map((u) => ({
    userID: u['UserID'],
    userEmail: u['UserEmail'],
    userName: u['UserName'],
    roleID: u['RoleID'],
    secondaryRoleID: u['SecondaryRoleID'],
    newStatus: u['UserStatus'] === 1 ? 'Active' : 'Inactive',
    employeeID: u['EmployeeID'],
    departments: departmentsByUser.get(u['UserID'] as number) ?? [],
    reportingManagerId: u['ReportingManagerID'],
    reportingManagerName: u['ReportingManagerName'],
    elManagerId: u['ELManagerID'],
    elManagerName: u['ELManagerName'],
    appraisalCycle: u['AppraisalCycle'],
    feedbackresolverteam: u['FeedbackResolverTeam'],
    userCreateTime: u['UserCreateTime'] instanceof Date
      ? u['UserCreateTime'].toISOString().slice(0, 19).replace('T', ' ')
      : u['UserCreateTime'],
  }));

  return { users, totalRecords: total, page: input.page, size: input.size };
}

// ─────────────────────────────────────────────────────────────
// POST /forgotPassword
// ─────────────────────────────────────────────────────────────
export async function forgotPassword(input: ForgotPasswordInput) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT UserID, UserEmail, UserName FROM Users WHERE UserEmail = ? AND IsUserArchived = 0 LIMIT 1',
    [input.email],
  );
  // Always return success to prevent email enumeration
  if ((rows as mysql.RowDataPacket[]).length === 0) {
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  const user = rows[0] as { UserID: number; UserEmail: string; UserName: string };
  const token = uuidv4();
  const now = new Date();
  const expiry = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

  // Invalidate old tokens
  await pool.execute(
    "UPDATE ForgotPassword SET status = 'USED' WHERE user_id = ? AND status = 'PENDING'",
    [user.UserID],
  );

  await pool.execute(
    `INSERT INTO ForgotPassword (uuid, user_id, token, start_time, end_time, status)
     VALUES (?, ?, ?, ?, ?, 'PENDING')`,
    [uuidv4(), user.UserID, token, now, expiry],
  );

  // Email sending is handled by mailer service — return token for now
  // In production the mailer would pick this up
  const resetLink = `${env.FRONTEND_URL}/reset-password?token=${token}`;

  return {
    message: 'If that email exists, a reset link has been sent.',
    // Only expose in development for easier testing
    ...(env.NODE_ENV === 'development' && { resetLink }),
  };
}

// ─────────────────────────────────────────────────────────────
// POST /resetPassword
// ─────────────────────────────────────────────────────────────
export async function resetPassword(input: ResetPasswordInput) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT fp.user_id, fp.end_time
     FROM ForgotPassword fp
     WHERE fp.token = ? AND fp.status = 'PENDING'
     LIMIT 1`,
    [input.token],
  );

  if ((rows as mysql.RowDataPacket[]).length === 0) throw AppError.badRequest('Invalid or expired reset token');

  const record = rows[0] as { user_id: number; end_time: string };
  if (new Date(record.end_time) < new Date()) {
    await pool.execute("UPDATE ForgotPassword SET status = 'EXPIRED' WHERE token = ?", [input.token]);
    throw AppError.badRequest('Reset token has expired');
  }

  const hashed = await bcrypt.hash(input.newPassword, 12);

  await pool.execute('UPDATE Users SET UserPassword = ? WHERE UserID = ?', [hashed, record.user_id]);
  await pool.execute("UPDATE ForgotPassword SET status = 'USED' WHERE token = ?", [input.token]);

  return { message: 'Password reset successfully' };
}

// ─────────────────────────────────────────────────────────────
// POST /updateUserStatus
// ─────────────────────────────────────────────────────────────
export async function updateUserStatus(input: UpdateUserStatusInput) {
  const placeholders = input.userIdList.map(() => '?').join(',');
  await pool.execute(
    `UPDATE Users SET UserStatus = ? WHERE UserID IN (${placeholders})`,
    [input.userStatus, ...input.userIdList],
  );
  return { message: 'User status updated' };
}

// ─────────────────────────────────────────────────────────────
// POST /usersArchive
// ─────────────────────────────────────────────────────────────
export async function archiveUsers(input: ArchiveUsersInput) {
  const placeholders = input.userIdList.map(() => '?').join(',');
  await pool.execute(
    `UPDATE Users SET IsUserArchived = ? WHERE UserID IN (${placeholders})`,
    [input.archive ? 1 : 0, ...input.userIdList],
  );
  return { message: `${input.userIdList.length} user(s) ${input.archive ? 'archived' : 'unarchived'}` };
}

// ─────────────────────────────────────────────────────────────
// POST /user/switch — admin impersonation
// ─────────────────────────────────────────────────────────────
export async function switchUser(targetUserID: number, requestingUser: { role: number; sid?: string; exp?: number }) {
  // Only admin role (e.g. RoleID = 1) can switch users — adjust as needed
  if (requestingUser.role !== 1) throw AppError.forbidden('Only admins can switch users');

  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `${USER_SELECT} WHERE UserID = ? AND IsUserArchived = 0 LIMIT 1`,
    [targetUserID],
  );

  const target = rows[0] as SessionUser | undefined;
  if (!target) throw AppError.notFound('Target user not found');
  if (target.UserStatus !== 1) throw AppError.badRequest('Target user is inactive');

  // Same flat shape as /authenticate — the frontend swaps it in as authUserLD
  // Bound to the admin's session: signing the admin out (or replacing the session) ends this view too
  if (!requestingUser.sid) throw AppError.unauthorized('Please sign in again', 'SESSION_INVALID');
  const remaining = Math.max((requestingUser.exp ?? 0) - Math.floor(Date.now() / 1000), 60);
  const session = await buildSessionPayload(target, signToken(target, requestingUser.sid, remaining));
  return { ...session, status: true, statusCode: 200 };
}

// ── Import mysql2 types for intellisense ──────────────────────────────────────
import type mysql from 'mysql2/promise';

// ── AMRole CRUD ────────────────────────────────────────────────────────────────
export async function listAMRoles(filter: { IsActive?: boolean; RoleLevel?: number } = {}) {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  if (filter.IsActive !== undefined) { conditions.push('IsActive = ?'); params.push(filter.IsActive ? 1 : 0); }
  if (filter.RoleLevel !== undefined) { conditions.push('RoleLevel = ?'); params.push(filter.RoleLevel); }
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT * FROM AMRole WHERE ${conditions.join(' AND ')} ORDER BY RoleLevel ASC`,
    params,
  );
  return rows;
}

export async function createAMRole(input: { RoleName: string; RoleLevel: number; Description?: string }) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    'INSERT INTO AMRole (RoleName, RoleLevel, Description, IsActive) VALUES (?, ?, ?, 1)',
    [input.RoleName, input.RoleLevel, input.Description ?? null],
  );
  const [[row]] = await pool.execute<mysql.RowDataPacket[]>('SELECT * FROM AMRole WHERE id = ?', [r.insertId]);
  return row;
}

export async function updateAMRole(id: number, input: {
  RoleName?: string; RoleLevel?: number; Description?: string; IsActive?: boolean;
}) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.RoleName !== undefined) { fields.push('RoleName = ?'); values.push(input.RoleName); }
  if (input.RoleLevel !== undefined) { fields.push('RoleLevel = ?'); values.push(input.RoleLevel); }
  if (input.Description !== undefined) { fields.push('Description = ?'); values.push(input.Description); }
  if (input.IsActive !== undefined) { fields.push('IsActive = ?'); values.push(input.IsActive ? 1 : 0); }
  if (!fields.length) throw new Error('No fields to update');
  values.push(id);
  await pool.query(`UPDATE AMRole SET ${fields.join(', ')} WHERE id = ?`, values);
  const [[row]] = await pool.execute<mysql.RowDataPacket[]>('SELECT * FROM AMRole WHERE id = ?', [id]);
  return row ?? null;
}

export async function updateAMRoleStatus(input: { id: number; IsActive: boolean }) {
  await pool.execute('UPDATE AMRole SET IsActive = ? WHERE id = ?', [input.IsActive ? 1 : 0, input.id]);
  const [[row]] = await pool.execute<mysql.RowDataPacket[]>('SELECT * FROM AMRole WHERE id = ?', [input.id]);
  return row ?? null;
}

export async function archiveAMRole(input: { id: number }) {
  await pool.execute('UPDATE AMRole SET IsArchived = 1, IsActive = 0 WHERE id = ?', [input.id]);
  return { message: 'AMRole archived' };
}

// GET /MissingData?startDate&endDate — active users with a department who logged no work in the range
export async function getMissingData(startDate?: string, endDate?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const from = startDate || today;
  const to = endDate || today;
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT u.UserID AS userID, u.UserName AS userName, u.UserEmail AS userEmail
     FROM Users u
     WHERE u.UserStatus = 1 AND u.IsUserArchived = 0 AND u.RoleID <> 1 AND EXISTS (SELECT 1 FROM DepartmentUser du WHERE du.UserID = u.UserID)
       AND NOT EXISTS (SELECT 1 FROM UserWorkData w WHERE w.UserID = u.UserID AND w.WorkDate BETWEEN ? AND ?)
     ORDER BY u.UserName`,
    [from, to],
  );
  return rows;
}

// POST /sendMailbulk — send bulk notification emails
export async function sendMailBulk(input: {
  userIds?: number[];
  subject: string;
  body: string;
}) {
  if (!input.userIds?.length) {
    return { sent: 0, message: 'No recipients' };
  }
  // In Java this called the mail service. Here we log and return success.
  // Wire up nodemailer/sendgrid in the mail util when ready.
  const placeholders = input.userIds.map(() => '?').join(',');
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT Email, UserName FROM Users WHERE UserID IN (${placeholders}) AND IsActive = 1`,
    input.userIds,
  );
  // TODO: integrate mail transport
  return { sent: rows.length, recipients: rows.map(r => r['Email']), message: 'Bulk mail queued' };
}
