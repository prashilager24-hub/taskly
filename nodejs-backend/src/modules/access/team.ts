import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { AppError } from '../../utils/AppError';
import { can } from './access.service';

/**
 * Whose work the viewer may see and act on: everyone for Admin / Super Admin (role 1), otherwise their team —
 * everyone below them in the reporting line and everyone in the sub departments they lead as EL or FL. Never themselves.
 */
export async function teamOf(viewerId: number, role: number): Promise<'all' | Set<number>> {
  if (role === 1) return 'all';
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `WITH RECURSIVE below AS (
       SELECT UserID FROM Users WHERE ReportingManagerID = ? AND IsUserArchived = 0
       UNION SELECT u.UserID FROM Users u JOIN below b ON u.ReportingManagerID = b.UserID WHERE u.IsUserArchived = 0
     )
     SELECT UserID FROM below
     UNION SELECT du.UserID FROM DepartmentUser du JOIN Department d ON d.DepartmentID = du.DepartmentID
      WHERE d.IsDepartmentArchived = 0 AND (d.ExecutiveLeaderID = ? OR d.FunctionalLeaderID = ?)`,
    [viewerId, viewerId, viewerId]);
  const team = new Set(rows.map((r) => Number(r['UserID'])));
  team.delete(viewerId);
  // never the people above them: their managers up the line, and the EL of a sub department where they are only the FL
  const [above] = await pool.query<mysql.RowDataPacket[]>(
    `WITH RECURSIVE up AS (
       SELECT ReportingManagerID AS UserID FROM Users WHERE UserID = ? AND ReportingManagerID IS NOT NULL
       UNION SELECT u.ReportingManagerID FROM Users u JOIN up ON u.UserID = up.UserID WHERE u.ReportingManagerID IS NOT NULL
     )
     SELECT UserID FROM up
     UNION SELECT d.ExecutiveLeaderID FROM Department d WHERE d.FunctionalLeaderID = ? AND d.ExecutiveLeaderID IS NOT NULL AND d.ExecutiveLeaderID <> ?`,
    [viewerId, viewerId, viewerId]);
  for (const r of above) team.delete(Number(r['UserID']));
  return team;
}

/** Throws unless every person is in the viewer's team (Admin / Super Admin: anyone) */
export async function assertTeam(viewerId: number, role: number, people: number[], message = 'You can do this only for people in your team') {
  const team = await teamOf(viewerId, role);
  if (team !== 'all' && people.some((p) => !team.has(p))) throw AppError.forbidden(message);
}

/** Who may read a person's reviews: themselves, their team leaders, Admin / Super Admin, and anyone with PMS Report (HR) */
export async function assertCanRead(viewerId: number, role: number, person: number) {
  if (viewerId === person || role === 1 || (await can(viewerId, 'pms_report', 'read'))) return;
  await assertTeam(viewerId, role, [person], 'You can see only your own and your team’s reviews');
}

/** null = everyone; otherwise the people whose reviews the viewer may list (themselves and their team) */
export async function readablePeople(viewerId: number, role: number): Promise<Set<number> | null> {
  if (role === 1 || (await can(viewerId, 'pms_report', 'read'))) return null;
  const team = await teamOf(viewerId, role);
  return team === 'all' ? null : new Set([viewerId, ...team]);
}
