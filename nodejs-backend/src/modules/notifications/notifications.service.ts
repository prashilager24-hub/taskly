import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { AppError } from '../../utils/AppError';

type Row = mysql.RowDataPacket;

export interface Audience { all: boolean; departments: number[]; roles: number[]; users: number[] }
export interface NotificationInput { title: string; body?: string; level?: string; linkUrl?: string; audience: Partial<Audience>; expiresAt?: string | null; active?: boolean }

const LEVELS = ['info', 'success', 'warning', 'urgent'];
const ids = (xs: unknown) => (Array.isArray(xs) ? [...new Set(xs.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : []);
const audienceOf = (a: Partial<Audience>): Audience => ({ all: !!a.all, departments: ids(a.departments), roles: ids(a.roles), users: ids(a.users) });
const parse = (raw: unknown): Audience => { try { return audienceOf(JSON.parse(String(raw))); } catch { return audienceOf({}); } };

/** Who can see a notification: everyone, or anyone matching a department / role / person in its audience */
const AUDIENCE_SQL = `(
  JSON_EXTRACT(n.Audience, '$.all') = true
  OR JSON_CONTAINS(n.Audience, CAST(u.UserID AS JSON), '$.users')
  OR JSON_CONTAINS(n.Audience, CAST(u.RoleID AS JSON), '$.roles')
  OR EXISTS (SELECT 1 FROM Department d WHERE JSON_CONTAINS(n.Audience, CAST(d.DepartmentID AS JSON), '$.departments')
       AND (d.DepartmentID IN (SELECT DepartmentID FROM DepartmentUser WHERE UserID = u.UserID) OR d.ExecutiveLeaderID = u.UserID OR d.FunctionalLeaderID = u.UserID))
)`;

const shape = (r: Row) => ({
  id: r['NotificationID'] as number, title: r['Title'] as string, body: (r['Body'] as string) ?? '', level: r['Level'] as string,
  linkUrl: (r['LinkUrl'] as string) ?? null, createdAt: r['CreatedAt'] as Date, expiresAt: (r['ExpiresAt'] as Date) ?? null,
});

/** What the signed-in person sees in the bell: meant for them, active, not expired, not closed by them */
export async function mine(userId: number) {
  const [rows] = await pool.execute<Row[]>(
    `SELECT n.*, s.ReadAt FROM Notification n
       JOIN Users u ON u.UserID = ?
       LEFT JOIN NotificationState s ON s.NotificationID = n.NotificationID AND s.UserID = u.UserID
      WHERE n.IsActive = 1 AND (n.ExpiresAt IS NULL OR n.ExpiresAt > ?) AND s.DismissedAt IS NULL AND ${AUDIENCE_SQL}
      ORDER BY n.CreatedAt DESC LIMIT 50`, [userId, new Date()]);
  return rows.map((r) => ({ ...shape(r), read: !!r['ReadAt'] }));
}

async function mark(userId: number, notificationIds: number[], field: 'ReadAt' | 'DismissedAt') {
  for (const id of notificationIds) {
    await pool.execute(
      `INSERT INTO NotificationState (NotificationID, UserID, ${field}) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE ${field} = COALESCE(${field}, VALUES(${field}))`, [id, userId, new Date()]);
  }
}
export async function mark1(userId: number, id: number, what: 'read' | 'dismiss') {
  await mark(userId, [id], 'ReadAt');
  if (what === 'dismiss') await mark(userId, [id], 'DismissedAt');
}
export async function markAll(userId: number, what: 'read' | 'dismiss') {
  const idsNow = (await mine(userId)).map((n) => n.id);
  await mark(userId, idsNow, 'ReadAt');
  if (what === 'dismiss') await mark(userId, idsNow, 'DismissedAt');
}

/** How many active people an audience reaches (shown while composing) */
export async function reach(a: Partial<Audience>) {
  const [[r]] = await pool.execute<Row[]>(
    `SELECT COUNT(*) AS c FROM Users u JOIN (SELECT ? AS Audience) n WHERE u.IsUserArchived = 0 AND u.UserStatus = 1 AND ${AUDIENCE_SQL}`,
    [JSON.stringify(audienceOf(a))]);
  return Number(r?.['c'] ?? 0);
}

export async function list() {
  const [rows] = await pool.execute<Row[]>(
    `SELECT n.*, cu.UserName AS CreatedByName,
            (SELECT COUNT(*) FROM NotificationState s WHERE s.NotificationID = n.NotificationID AND s.ReadAt IS NOT NULL) AS ReadCount
       FROM Notification n LEFT JOIN Users cu ON cu.UserID = n.CreatedBy ORDER BY n.CreatedAt DESC LIMIT 200`);
  const out = [];
  for (const r of rows) {
    const audience = parse(r['Audience']);
    out.push({ ...shape(r), active: !!r['IsActive'], audience, createdBy: r['CreatedByName'] ?? 'Admin', readCount: Number(r['ReadCount']), reach: await reach(audience) });
  }
  return out;
}

function clean(input: NotificationInput) {
  const title = input.title?.trim();
  if (!title) throw AppError.badRequest('Add a title');
  const audience = audienceOf(input.audience ?? {});
  if (!audience.all && !audience.departments.length && !audience.roles.length && !audience.users.length) throw AppError.badRequest('Choose who should get this');
  const expires = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expires && Number.isNaN(expires.getTime())) throw AppError.badRequest('That expiry date is not valid');
  return { title, body: input.body?.trim() || null, level: LEVELS.includes(input.level ?? '') ? input.level! : 'info', link: input.linkUrl?.trim() || null, audience, expires };
}

export async function create(actor: number, input: NotificationInput) {
  const c = clean(input);
  const [res] = await pool.execute<mysql.ResultSetHeader>(
    'INSERT INTO Notification (Title, Body, Level, LinkUrl, Audience, ExpiresAt, IsActive, CreatedBy, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [c.title, c.body, c.level, c.link, JSON.stringify(c.audience), c.expires, input.active === false ? 0 : 1, actor, new Date()]);
  return res.insertId;
}

export async function update(id: number, input: NotificationInput) {
  const c = clean(input);
  const [res] = await pool.execute<mysql.ResultSetHeader>(
    'UPDATE Notification SET Title = ?, Body = ?, Level = ?, LinkUrl = ?, Audience = ?, ExpiresAt = ?, IsActive = ? WHERE NotificationID = ?',
    [c.title, c.body, c.level, c.link, JSON.stringify(c.audience), c.expires, input.active === false ? 0 : 1, id]);
  if (!res.affectedRows) throw AppError.notFound('Notification not found');
}

export async function remove(id: number) {
  await pool.execute('DELETE FROM NotificationState WHERE NotificationID = ?', [id]);
  await pool.execute('DELETE FROM Notification WHERE NotificationID = ?', [id]);
}

/** The departments, roles and people an admin can aim a notification at */
export async function audienceOptions() {
  const [departments] = await pool.execute<Row[]>("SELECT DepartmentID AS id, DepartmentName AS name FROM Department WHERE IsDepartmentArchived = 0 AND DepartmentStatus = 1 ORDER BY DepartmentName");
  const [roles] = await pool.execute<Row[]>("SELECT RoleID AS id, RoleName AS name FROM AMRole ORDER BY RoleName");
  const [users] = await pool.execute<Row[]>(
    `SELECT u.UserID AS id, u.UserName AS name, u.UserEmail AS email,
            (SELECT GROUP_CONCAT(d.DepartmentName SEPARATOR ', ') FROM DepartmentUser du JOIN Department d ON d.DepartmentID = du.DepartmentID WHERE du.UserID = u.UserID) AS dept
       FROM Users u WHERE u.IsUserArchived = 0 AND u.UserStatus = 1 ORDER BY u.UserName`);
  return { departments, roles, users };
}
