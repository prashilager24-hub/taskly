/**
 * Access Management. What a person can open is:
 *   role access  +  access of their departments  +  their own grants  −  their own denies
 * Super Admin (role 1) always has everything, so nobody can lock the last admin out.
 */
import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { AppError } from '../../utils/AppError';
import { ACTIONS, CATALOG, FULL_ACCESS, MODULE_IDS, normalize, type Privileges } from './catalog';

type Row = mysql.RowDataPacket;

const parse = (text: unknown, implyRead = true): Privileges => {
  if (typeof text !== 'string' || !text) return {};
  try { return normalize(JSON.parse(text), implyRead); } catch { return {}; }
};

/** a ∪ b */
const union = (...list: Privileges[]): Privileges => {
  const out: Record<string, Set<string>> = {};
  for (const p of list) for (const [m, acts] of Object.entries(p)) { const s = (out[m] ??= new Set()); for (const a of acts as string[]) s.add(a); }
  return normalize(Object.fromEntries(Object.entries(out).map(([m, s]) => [m, [...s]])));
};

/** a − b (action by action; a module with no actions left is removed) */
const minus = (a: Privileges, b: Privileges): Privileges => {
  const out: Record<string, string[]> = {};
  for (const [m, acts] of Object.entries(a)) {
    if ((b[m] as string[] | undefined)?.includes('read')) continue; // taking away View takes away the whole module
    const left = (acts as string[]).filter((x) => !(b[m] as string[] | undefined)?.includes(x));
    if (left.length) out[m] = left;
  }
  return normalize(out);
};

export async function logChange(actor: number | null, target: 'role' | 'department' | 'user' | 'security', targetId: number | null, summary: string) {
  await pool.execute('INSERT INTO AccessLog (ActorID, Target, TargetID, Summary) VALUES (?, ?, ?, ?)', [actor, target, targetId, summary.slice(0, 500)]);
}

export async function listLog(limit = 30) {
  const [rows] = await pool.query<Row[]>(
    `SELECT l.LogID, l.Target, l.TargetID, l.Summary, l.CreatedAt, u.UserName AS actor
     FROM AccessLog l LEFT JOIN Users u ON u.UserID = l.ActorID ORDER BY l.LogID DESC LIMIT ?`, [limit]);
  return rows.map((r) => ({ id: r['LogID'], target: r['Target'], targetId: r['TargetID'], summary: r['Summary'], at: r['CreatedAt'], actor: r['actor'] ?? 'System' }));
}

// ── Roles ────────────────────────────────────────────────────────────────────

export async function listRoles() {
  const [rows] = await pool.query<Row[]>(
    `SELECT r.RoleID, r.RoleName, r.RoleDescription, r.RolePrivileges, r.RoleStatus,
            (SELECT COUNT(*) FROM Users u WHERE (u.RoleID = r.RoleID OR u.SecondaryRoleID = r.RoleID) AND u.IsUserArchived = 0) AS userCount
     FROM AMRole r WHERE r.IsRoleArchived = 0 ORDER BY r.RoleID`);
  return rows.map((r) => ({
    roleId: r['RoleID'], roleName: r['RoleName'], description: r['RoleDescription'] ?? '', active: r['RoleStatus'] === 1,
    userCount: Number(r['userCount']), system: r['RoleID'] === 1, privileges: r['RoleID'] === 1 ? FULL_ACCESS : parse(r['RolePrivileges']),
  }));
}

export async function saveRole(actor: number, input: { roleId?: number; roleName: string; description?: string; active?: boolean; privileges: unknown }) {
  const name = input.roleName.trim();
  if (name.length < 2) throw AppError.badRequest('Give the role a name');
  const privileges = JSON.stringify(normalize(input.privileges));
  const [dupe] = await pool.execute<Row[]>('SELECT RoleID FROM AMRole WHERE RoleName = ? AND IsRoleArchived = 0 AND RoleID <> ?', [name, input.roleId ?? 0]);
  if (dupe.length) throw AppError.conflict('A role with this name already exists');

  if (input.roleId) {
    if (input.roleId === 1) throw AppError.forbidden('Super Admin always has full access and cannot be changed');
    const [res] = await pool.execute<mysql.ResultSetHeader>(
      'UPDATE AMRole SET RoleName = ?, RoleDescription = ?, RolePrivileges = ?, RoleStatus = ?, RoleModifyTime = NOW() WHERE RoleID = ? AND IsRoleArchived = 0',
      [name, input.description ?? null, privileges, input.active === false ? 0 : 1, input.roleId]);
    if (!res.affectedRows) throw AppError.notFound('Role not found');
    await logChange(actor, 'role', input.roleId, `Updated role "${name}"`);
    return input.roleId;
  }
  const [res] = await pool.execute<mysql.ResultSetHeader>(
    'INSERT INTO AMRole (RoleName, RoleDescription, RolePrivileges, RoleStatus, IsRoleArchived, RoleCreateTime, RoleModifyTime) VALUES (?, ?, ?, 1, 0, NOW(), NOW())',
    [name, input.description ?? null, privileges]);
  await logChange(actor, 'role', res.insertId, `Created role "${name}"`);
  return res.insertId;
}

export async function archiveRole(actor: number, roleId: number) {
  if (roleId === 1) throw AppError.forbidden('Super Admin cannot be removed');
  const [[inUse]] = await pool.execute<Row[]>('SELECT COUNT(*) AS n FROM Users WHERE (RoleID = ? OR SecondaryRoleID = ?) AND IsUserArchived = 0', [roleId, roleId]);
  if (Number(inUse!['n']) > 0) throw AppError.conflict(`${inUse!['n']} user(s) still have this role. Move them to another role first.`);
  const [[role]] = await pool.execute<Row[]>('SELECT RoleName FROM AMRole WHERE RoleID = ?', [roleId]);
  await pool.execute('UPDATE AMRole SET IsRoleArchived = 1, RoleStatus = 0 WHERE RoleID = ?', [roleId]);
  await logChange(actor, 'role', roleId, `Removed role "${role?.['RoleName'] ?? roleId}"`);
}

// ── Departments ──────────────────────────────────────────────────────────────

export async function listDepartments() {
  const [rows] = await pool.query<Row[]>(
    `SELECT d.DepartmentID, d.DepartmentName, a.Privileges,
            (SELECT COUNT(*) FROM DepartmentUser du JOIN Users u ON u.UserID = du.UserID WHERE du.DepartmentID = d.DepartmentID AND u.IsUserArchived = 0) AS memberCount
     FROM Department d LEFT JOIN DepartmentAccess a ON a.DepartmentID = d.DepartmentID
     WHERE d.IsDepartmentArchived = 0 AND d.DepartmentStatus = 1 ORDER BY d.DepartmentName`);
  return rows.map((r) => ({ departmentId: r['DepartmentID'], name: r['DepartmentName'], memberCount: Number(r['memberCount']), privileges: parse(r['Privileges']) }));
}

export async function setDepartmentAccess(actor: number, departmentId: number, privileges: unknown) {
  const [[d]] = await pool.execute<Row[]>('SELECT DepartmentName FROM Department WHERE DepartmentID = ?', [departmentId]);
  if (!d) throw AppError.notFound('Department not found');
  const clean = normalize(privileges);
  await pool.execute(
    'INSERT INTO DepartmentAccess (DepartmentID, Privileges, UpdatedBy) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE Privileges = VALUES(Privileges), UpdatedBy = VALUES(UpdatedBy)',
    [departmentId, JSON.stringify(clean), actor]);
  await logChange(actor, 'department', departmentId, `Updated department access for "${d['DepartmentName']}" (${Object.keys(clean).length} modules)`);
}

// ── Effective access ─────────────────────────────────────────────────────────

interface Layers { roleIds: number[]; roleNames: string[]; role: Privileges; departments: { id: number; name: string }[]; department: Privileges; grants: Privileges; denies: Privileges; isSuperAdmin: boolean }

async function layersOf(userId: number): Promise<Layers> {
  const [[u]] = await pool.execute<Row[]>('SELECT RoleID, SecondaryRoleID FROM Users WHERE UserID = ?', [userId]);
  if (!u) throw AppError.notFound('User not found');
  const roleIds = [u['RoleID'], u['SecondaryRoleID']].filter((x): x is number => !!x);
  const [roles] = await pool.query<Row[]>('SELECT RoleID, RoleName, RolePrivileges FROM AMRole WHERE RoleID IN (?) AND IsRoleArchived = 0 AND RoleStatus = 1', [roleIds.length ? roleIds : [0]]);
  const [depts] = await pool.query<Row[]>(
    `SELECT DISTINCT d.DepartmentID, d.DepartmentName, a.Privileges FROM Department d
     LEFT JOIN DepartmentAccess a ON a.DepartmentID = d.DepartmentID
     WHERE d.IsDepartmentArchived = 0 AND d.DepartmentStatus = 1
       AND (d.DepartmentID IN (SELECT DepartmentID FROM DepartmentUser WHERE UserID = ?) OR d.ExecutiveLeaderID = ? OR d.FunctionalLeaderID = ?)`, [userId, userId, userId]);
  const [[o]] = await pool.execute<Row[]>('SELECT Grants, Denies FROM UserAccess WHERE UserID = ?', [userId]);
  return {
    roleIds, roleNames: roles.map((r) => r['RoleName']), role: union(...roles.map((r) => parse(r['RolePrivileges']))),
    departments: depts.map((d) => ({ id: d['DepartmentID'], name: d['DepartmentName'] })), department: union(...depts.map((d) => parse(d['Privileges']))),
    grants: parse(o?.['Grants']), denies: parse(o?.['Denies'], false), isSuperAdmin: roleIds.includes(1),
  };
}

export async function effectivePrivileges(userId: number): Promise<Privileges> {
  const l = await layersOf(userId);
  if (l.isSuperAdmin) return FULL_ACCESS;
  return minus(union(l.role, l.department, l.grants), l.denies);
}

/** Everything the Access screen needs to show why a person can (or cannot) open each module */
export async function explainUser(userId: number) {
  const l = await layersOf(userId);
  const effective = l.isSuperAdmin ? FULL_ACCESS : minus(union(l.role, l.department, l.grants), l.denies);
  const modules = MODULE_IDS.map((id) => ({
    id, role: l.isSuperAdmin ? [...ACTIONS] : (l.role[id] ?? []), department: l.department[id] ?? [], grants: l.grants[id] ?? [], denies: l.denies[id] ?? [], effective: effective[id] ?? [],
  }));
  return { roleNames: l.roleNames, departments: l.departments, isSuperAdmin: l.isSuperAdmin, grants: l.grants, denies: l.denies, effective, modules };
}

export async function setUserAccess(actor: number, userId: number, input: { grants?: unknown; denies?: unknown }) {
  const [[u]] = await pool.execute<Row[]>('SELECT UserName, RoleID FROM Users WHERE UserID = ?', [userId]);
  if (!u) throw AppError.notFound('User not found');
  if (u['RoleID'] === 1) throw AppError.forbidden('Super Admin always has full access');
  const grants = normalize(input.grants), denies = normalize(input.denies, false);
  await pool.execute(
    'INSERT INTO UserAccess (UserID, Grants, Denies, UpdatedBy) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE Grants = VALUES(Grants), Denies = VALUES(Denies), UpdatedBy = VALUES(UpdatedBy)',
    [userId, JSON.stringify(grants), JSON.stringify(denies), actor]);
  await logChange(actor, 'user', userId, `Updated access for ${u['UserName']} (${Object.keys(grants).length} extra, ${Object.keys(denies).length} removed)`);
}

/** Does this person hold `action` on `module`? */
export async function can(userId: number, module: string, action: (typeof ACTIONS)[number] = 'read') {
  return !!(await effectivePrivileges(userId))[module]?.includes(action);
}

// ── Users overview ───────────────────────────────────────────────────────────

export async function listUsers() {
  const [rows] = await pool.query<Row[]>(
    `SELECT u.UserID, u.UserName, u.UserEmail, u.EmployeeID, u.RoleID, u.SecondaryRoleID, u.UserStatus, u.TwoFactor,
            r.RoleName, r2.RoleName AS SecondaryRoleName,
            (SELECT GROUP_CONCAT(d.DepartmentName ORDER BY d.DepartmentName SEPARATOR '||') FROM DepartmentUser du JOIN Department d ON d.DepartmentID = du.DepartmentID WHERE du.UserID = u.UserID) AS departments,
            (a.UserID IS NOT NULL AND (a.Grants NOT IN ('{}', 'null') OR a.Denies NOT IN ('{}', 'null'))) AS hasOverrides
     FROM Users u LEFT JOIN AMRole r ON r.RoleID = u.RoleID LEFT JOIN AMRole r2 ON r2.RoleID = u.SecondaryRoleID LEFT JOIN UserAccess a ON a.UserID = u.UserID
     WHERE u.IsUserArchived = 0 ORDER BY u.UserName`);
  const def = await twoFactorDefault();
  return rows.map((r) => ({
    userId: r['UserID'], name: r['UserName'], email: r['UserEmail'], employeeId: r['EmployeeID'], roleId: r['RoleID'], roleName: r['RoleName'] ?? 'No role',
    secondaryRoleId: r['SecondaryRoleID'] ?? null, secondaryRoleName: r['SecondaryRoleName'] ?? null, active: r['UserStatus'] === 1,
    departments: r['departments'] ? String(r['departments']).split('||') : [],
    twoFactor: r['TwoFactor'] === null ? 'default' : r['TwoFactor'] ? 'on' : 'off',
    twoFactorEffective: r['TwoFactor'] === null ? def : !!r['TwoFactor'],
    hasOverrides: !!Number(r['hasOverrides']),
  }));
}

// ── Two-factor ───────────────────────────────────────────────────────────────

export async function twoFactorDefault(): Promise<boolean> {
  const [[r]] = await pool.execute<Row[]>("SELECT SettingValue FROM AppSetting WHERE SettingKey = 'twoFactorDefault'");
  return (r?.['SettingValue'] ?? 'on') !== 'off';
}

/** Is a sign-in code required for this person? */
export async function twoFactorRequired(user: { UserID: number; TwoFactor?: number | null }): Promise<boolean> {
  if (user.TwoFactor === 1) return true;
  if (user.TwoFactor === 0) return false;
  return twoFactorDefault();
}

export async function security() {
  const users = await listUsers();
  return {
    twoFactorDefault: (await twoFactorDefault()) ? 'on' : 'off',
    totals: { users: users.length, withTwoFactor: users.filter((u) => u.twoFactorEffective).length, withoutTwoFactor: users.filter((u) => !u.twoFactorEffective).length },
  };
}

export async function setTwoFactorDefault(actor: number, value: 'on' | 'off') {
  await pool.execute("INSERT INTO AppSetting (SettingKey, SettingValue) VALUES ('twoFactorDefault', ?) ON DUPLICATE KEY UPDATE SettingValue = VALUES(SettingValue)", [value]);
  await logChange(actor, 'security', null, `Two-factor sign-in turned ${value} by default`);
}

export async function setUserTwoFactor(actor: number, userIds: number[], value: 'default' | 'on' | 'off') {
  if (!userIds.length) return;
  await pool.query('UPDATE Users SET TwoFactor = ? WHERE UserID IN (?)', [value === 'default' ? null : value === 'on' ? 1 : 0, userIds]);
  await logChange(actor, 'security', userIds.length === 1 ? userIds[0]! : null, `Two-factor set to "${value}" for ${userIds.length} user(s)`);
}

export const catalog = () => CATALOG;
