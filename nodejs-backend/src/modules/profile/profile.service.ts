/**
 * User profile: who a person is (position, role, department, reporting line) and their sign-in activity.
 * A person sees their own; Access Management admins can see anyone's.
 *
 * Times come back as "YYYY-MM-DD HH:mm:ss" exactly as the server recorded them: the database writes server
 * local time, so they are formatted in SQL instead of passing through a Date.
 */
import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { AppError } from '../../utils/AppError';
import { can } from '../access/access.service';

type Row = mysql.RowDataPacket;
const STAMP = (col: string) => `DATE_FORMAT(${col}, '%Y-%m-%d %H:%i:%s')`;

export async function assertCanView(requesterId: number, targetId: number) {
  if (requesterId === targetId) return;
  if (!(await can(requesterId, 'accessmgmt', 'read'))) throw AppError.forbidden('You can only open your own profile.');
}

export async function getProfile(userId: number) {
  const [[u]] = await pool.query<Row[]>(
    `SELECT u.UserID, u.UserName, u.UserEmail, u.EmployeeID, u.Designation, u.JobLevel, u.Band, u.RoleID, r.RoleName, r.UserType, u.UserRole,
            u.SecondaryRoleID, r2.RoleName AS SecondaryRoleName, u.UserStatus, u.IsUserArchived, u.AppraisalCycle,
            ${STAMP('u.UserCreateTime')} AS AddedOn,
            u.ReportingManagerID, rm.UserName AS ReportingManagerName, rm.Designation AS ReportingManagerDesignation,
            u.ELManagerID, el.UserName AS ELName, el.Designation AS ELDesignation
     FROM Users u
     LEFT JOIN AMRole r ON r.RoleID = u.RoleID
     LEFT JOIN AMRole r2 ON r2.RoleID = u.SecondaryRoleID
     LEFT JOIN Users rm ON rm.UserID = u.ReportingManagerID
     LEFT JOIN Users el ON el.UserID = u.ELManagerID
     WHERE u.UserID = ?`, [userId]);
  if (!u) throw AppError.notFound('User not found');

  const [departments] = await pool.query<Row[]>(
    `SELECT d.DepartmentID, d.DepartmentName, pd.PrimaryDepartmentName
     FROM DepartmentUser du JOIN Department d ON d.DepartmentID = du.DepartmentID
     LEFT JOIN PrimaryDepartment pd ON pd.PrimaryDepartmentId = d.PrimaryDepartmentId
     WHERE du.UserID = ? ORDER BY d.DepartmentName`, [userId]);
  const [leads] = await pool.query<Row[]>(
    `SELECT DepartmentID, DepartmentName, ExecutiveLeaderID, FunctionalLeaderID FROM Department
     WHERE (ExecutiveLeaderID = ? OR FunctionalLeaderID = ?) AND IsDepartmentArchived = 0 ORDER BY DepartmentName`, [userId, userId]);

  const person = (id: unknown, name: unknown, designation: unknown) => (id ? { userId: id as number, name: name as string, designation: (designation as string) ?? null } : null);
  return {
    userId: u['UserID'], name: u['UserName'], email: u['UserEmail'], employeeId: u['EmployeeID'] ?? null,
    designation: u['Designation'] ?? null, jobLevel: u['JobLevel'] ?? null, band: u['Band'] ?? null,
    role: { id: u['RoleID'], name: u['RoleName'] ?? null }, userType: u['UserType'] ?? null, userRole: u['UserRole'] ?? null, secondaryRole: u['SecondaryRoleID'] ? { id: u['SecondaryRoleID'], name: u['SecondaryRoleName'] ?? null } : null,
    active: u['UserStatus'] === 1 && !u['IsUserArchived'], appraisalCycle: u['AppraisalCycle'] ?? null, addedOn: u['AddedOn'],
    reportingManager: person(u['ReportingManagerID'], u['ReportingManagerName'], u['ReportingManagerDesignation']),
    executiveLeader: person(u['ELManagerID'], u['ELName'], u['ELDesignation']),
    departments: departments.map((d) => ({ id: d['DepartmentID'], name: d['DepartmentName'], primaryDepartment: d['PrimaryDepartmentName'] ?? null })),
    leads: leads.map((d) => ({ id: d['DepartmentID'], name: d['DepartmentName'], as: d['ExecutiveLeaderID'] === userId ? 'Executive Leader' : 'Functional Leader' })),
  };
}

type EndedBy = 'ACTIVE' | 'LOGOUT' | 'REPLACED' | 'EXPIRED' | 'REVOKED';

/** Sign-ins with when each ended and how, plus every sign-in event, for the last `days` days */
export async function getActivity(userId: number, days: number) {
  const range = Math.min(Math.max(Math.floor(days) || 90, 1), 365);
  const [sessions] = await pool.query<Row[]>(
    `SELECT SessionID, KeepSignedIn, UserAgent, IPAddress, ${STAMP('CreatedAt')} AS SignedIn, ${STAMP('ExpiresAt')} AS ExpiresAt,
            ${STAMP('RevokedAt')} AS RevokedAt, RevokedReason, ExpiresAt < NOW() AS Expired,
            TIMESTAMPDIFF(MINUTE, CreatedAt, COALESCE(RevokedAt, LEAST(ExpiresAt, NOW()))) AS Minutes
     FROM UserSession WHERE UserID = ? AND CreatedAt >= NOW() - INTERVAL ? DAY ORDER BY CreatedAt DESC LIMIT 300`, [userId, range]);
  const [events] = await pool.query<Row[]>(
    `SELECT EventID, Event, IPAddress, UserAgent, ${STAMP('CreatedAt')} AS At
     FROM AuthEvent WHERE UserID = ? AND CreatedAt >= NOW() - INTERVAL ? DAY ORDER BY CreatedAt DESC, EventID DESC LIMIT 500`, [userId, range]);

  const rows = sessions.map((s) => {
    const revoked = !!s['RevokedAt'];
    const endedBy: EndedBy = revoked ? (s['RevokedReason'] === 'LOGOUT' ? 'LOGOUT' : s['RevokedReason'] === 'REPLACED' ? 'REPLACED' : 'REVOKED') : Number(s['Expired']) ? 'EXPIRED' : 'ACTIVE';
    return {
      id: s['SessionID'], signedIn: s['SignedIn'], endedAt: revoked ? s['RevokedAt'] : endedBy === 'EXPIRED' ? s['ExpiresAt'] : null, endedBy,
      minutes: Number(s['Minutes']) || 0, keepSignedIn: !!s['KeepSignedIn'], device: s['UserAgent'] ?? null, ip: s['IPAddress'] ?? null,
    };
  });
  const failed = events.filter((e) => ['PASSWORD_FAIL', 'OTP_FAIL', 'OTP_LOCKED'].includes(e['Event'])).length;
  return {
    days: range,
    summary: {
      lastSignIn: rows[0]?.signedIn ?? null,
      activeNow: rows.filter((r) => r.endedBy === 'ACTIVE').length,
      signIns: rows.length,
      failedAttempts: failed,
    },
    sessions: rows,
    events: events.map((e) => ({ id: e['EventID'], event: e['Event'], at: e['At'], ip: e['IPAddress'] ?? null, device: e['UserAgent'] ?? null })),
  };
}
