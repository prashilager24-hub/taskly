import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
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
  UserStatus: string;
  IsUserArchived: number;
  EmployeeID: string | null;
  ReportingManagerID: number | null;
  ELManagerID: number | null;
  AppraisalCycle: string | null;
  UserCreateTime?: string;
}

// ─────────────────────────────────────────────────────────────
// Helper: sign a JWT for a user row
// ─────────────────────────────────────────────────────────────
function signToken(user: UserRow): string {
  return jwt.sign(
    {
      sub: String(user.UserID),
      email: user.UserEmail,
      username: user.UserName,
      role: user.RoleID,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );
}

// ─────────────────────────────────────────────────────────────
// POST /authenticate
// ─────────────────────────────────────────────────────────────
export async function login(input: LoginInput) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT UserID, UserEmail, UserName, UserPassword, RoleID, SecondaryRoleID,
            UserStatus, IsUserArchived, EmployeeID, ReportingManagerID,
            ELManagerID, AppraisalCycle
     FROM Users
     WHERE (UserEmail = ? OR UserName = ?)
       AND IsUserArchived = 0
     LIMIT 1`,
    [input.username, input.username],
  );

  const user = rows[0] as UserRow | undefined;
  if (!user) throw AppError.unauthorized('Invalid credentials');
  if (user.UserStatus !== 'ACTIVE') throw AppError.unauthorized('Account is inactive');

  const match = await bcrypt.compare(input.password, user.UserPassword);
  if (!match) throw AppError.unauthorized('Invalid credentials');

  const token = signToken(user);

  return {
    token,
    userRole: user.RoleID,
    secondaryRole: user.SecondaryRoleID,
    userID: user.UserID,
    userName: user.UserName,
    userEmail: user.UserEmail,
    employeeID: user.EmployeeID,
    reportingManagerID: user.ReportingManagerID,
    userStatus: user.UserStatus,
  };
}

// ─────────────────────────────────────────────────────────────
// GET /AMRole/:roleId  — fetch role privileges
// ─────────────────────────────────────────────────────────────
export async function getRole(roleId: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT RoleID, RoleName, RolePrivileges, RoleStatus
     FROM AMRole WHERE RoleID = ? AND IsRoleArchived = 0 LIMIT 1`,
    [roleId],
  );
  const role = rows[0];
  if (!role) throw AppError.notFound('Role not found');

  // RolePrivileges stored as JSON string in DB
  if (typeof role['RolePrivileges'] === 'string') {
    try {
      role['RolePrivileges'] = JSON.parse(role['RolePrivileges'] as string);
    } catch {
      // leave as-is
    }
  }
  return role;
}

// ─────────────────────────────────────────────────────────────
// POST /User/create
// ─────────────────────────────────────────────────────────────
export async function createUser(input: CreateUserInput, createdBy: number) {
  // Check duplicate email
  const [dup] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT UserID FROM Users WHERE UserEmail = ? LIMIT 1',
    [input.UserEmail],
  );
  if ((dup as mysql.RowDataPacket[]).length > 0) throw AppError.conflict('Email already in use');

  const hashed = await bcrypt.hash(input.UserPassword, 12);

  const [result] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO Users
       (UserEmail, UserName, UserPassword, RoleID, SecondaryRoleID,
        UserStatus, IsUserArchived, EmployeeID, ReportingManagerID,
        ELManagerID, AppraisalCycle)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, ?, ?, ?, ?)`,
    [
      input.UserEmail,
      input.UserName,
      hashed,
      input.RoleID,
      input.SecondaryRoleID ?? null,
      input.EmployeeID ?? null,
      input.ReportingManagerID ?? null,
      input.ELManagerID ?? null,
      input.AppraisalCycle ?? null,
    ],
  );

  void createdBy; // audit log can be added later

  return { UserID: result.insertId, message: 'User created successfully' };
}

// ─────────────────────────────────────────────────────────────
// PUT /User/update
// ─────────────────────────────────────────────────────────────
export async function updateUser(input: UpdateUserInput) {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.UserEmail !== undefined) { fields.push('UserEmail = ?'); values.push(input.UserEmail); }
  if (input.UserName !== undefined) { fields.push('UserName = ?'); values.push(input.UserName); }
  if (input.RoleID !== undefined) { fields.push('RoleID = ?'); values.push(input.RoleID); }
  if (input.SecondaryRoleID !== undefined) { fields.push('SecondaryRoleID = ?'); values.push(input.SecondaryRoleID); }
  if (input.EmployeeID !== undefined) { fields.push('EmployeeID = ?'); values.push(input.EmployeeID); }
  if (input.ReportingManagerID !== undefined) { fields.push('ReportingManagerID = ?'); values.push(input.ReportingManagerID); }
  if (input.ELManagerID !== undefined) { fields.push('ELManagerID = ?'); values.push(input.ELManagerID); }
  if (input.AppraisalCycle !== undefined) { fields.push('AppraisalCycle = ?'); values.push(input.AppraisalCycle); }

  if (fields.length === 0) throw AppError.badRequest('No fields to update');

  values.push(input.UserID);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await pool.execute(`UPDATE Users SET ${fields.join(', ')} WHERE UserID = ?`, values as any);

  return { message: 'User updated successfully' };
}

// ─────────────────────────────────────────────────────────────
// POST /users/read
// ─────────────────────────────────────────────────────────────
export async function getUsers(input: UsersReadInput) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (input.search) {
    conditions.push('(u.UserName LIKE ? OR u.UserEmail LIKE ? OR u.EmployeeID LIKE ?)');
    const like = `%${input.search}%`;
    params.push(like, like, like);
  }
  if (input.RoleID !== undefined) {
    conditions.push('u.RoleID = ?');
    params.push(input.RoleID);
  }
  if (input.IsUserArchived !== undefined) {
    conditions.push('u.IsUserArchived = ?');
    params.push(input.IsUserArchived ? 1 : 0);
  } else {
    conditions.push('u.IsUserArchived = 0');
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (input.page - 1) * input.pageSize;

  const [countRows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM Users u ${where}`,
    params,
  );
  const total = (countRows[0] as { total: number }).total;

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT u.UserID, u.UserEmail, u.UserName, u.RoleID, u.SecondaryRoleID,
            u.UserStatus, u.IsUserArchived, u.EmployeeID,
            u.ReportingManagerID, u.ELManagerID, u.AppraisalCycle,
            r.RoleName
     FROM Users u
     LEFT JOIN AMRole r ON r.RoleID = u.RoleID
     ${where}
     ORDER BY u.UserID DESC
     LIMIT ? OFFSET ?`,
    [...params, input.pageSize, offset],
  );

  return { users: rows, total, page: input.page, pageSize: input.pageSize };
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
  await pool.execute('UPDATE Users SET UserStatus = ? WHERE UserID = ?', [input.UserStatus, input.UserID]);
  return { message: 'User status updated' };
}

// ─────────────────────────────────────────────────────────────
// POST /usersArchive
// ─────────────────────────────────────────────────────────────
export async function archiveUsers(input: ArchiveUsersInput) {
  const placeholders = input.userIds.map(() => '?').join(',');
  await pool.execute(
    `UPDATE Users SET IsUserArchived = ? WHERE UserID IN (${placeholders})`,
    [input.archive ? 1 : 0, ...input.userIds],
  );
  return { message: `${input.userIds.length} user(s) ${input.archive ? 'archived' : 'unarchived'}` };
}

// ─────────────────────────────────────────────────────────────
// POST /user/switch — admin impersonation
// ─────────────────────────────────────────────────────────────
export async function switchUser(targetUserID: number, requestingUser: { role: number }) {
  // Only admin role (e.g. RoleID = 1) can switch users — adjust as needed
  if (requestingUser.role !== 1) throw AppError.forbidden('Only admins can switch users');

  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT UserID, UserEmail, UserName, RoleID, SecondaryRoleID, UserStatus, IsUserArchived
     FROM Users WHERE UserID = ? AND IsUserArchived = 0 LIMIT 1`,
    [targetUserID],
  );

  const target = rows[0] as UserRow | undefined;
  if (!target) throw AppError.notFound('Target user not found');
  if (target.UserStatus !== 'ACTIVE') throw AppError.badRequest('Target user is inactive');

  const token = signToken(target);
  return {
    token,
    userRole: target.RoleID,
    userID: target.UserID,
    userName: target.UserName,
    userEmail: target.UserEmail,
  };
}

// ── Import mysql2 types for intellisense ──────────────────────────────────────
import type mysql from 'mysql2/promise';
