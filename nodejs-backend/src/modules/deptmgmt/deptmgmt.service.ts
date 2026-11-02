import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { AppError } from '../../utils/AppError';

/**
 * Department Management. A department (PrimaryDepartment, TM-D##) holds sub departments (Department table, TM-SD##);
 * people (DepartmentUser), tasks, targets and goals belong to a sub department. A department made without sub
 * departments gets one hidden "team" sub department (IsDepartmentTeam) that holds them. IDs are never reused.
 */

type Row = mysql.RowDataPacket;
type Db = mysql.Pool | mysql.PoolConnection;

export const TYPES = ['BUSINESS', 'SUPPORT'] as const;
export const CRITERIA = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'COMBINED'] as const;

const ref = (id: unknown, name: unknown) => (id ? { userId: Number(id), name: String(name ?? '') } : null);
const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : null);

async function tx<T>(fn: (c: mysql.PoolConnection) => Promise<T>) {
  const c = await pool.getConnection();
  try { await c.beginTransaction(); const out = await fn(c); await c.commit(); return out; }
  catch (e) { await c.rollback(); throw e; }
  finally { c.release(); }
}

/** The next free ID: TM-D16, TM-SD62 … (counted over every row ever given one, so a removed ID is not given again) */
export async function nextCode(db: Db, kind: 'D' | 'SD') {
  const [table, prefix] = kind === 'D' ? ['PrimaryDepartment', 'TM-D'] : ['Department', 'TM-SD'];
  const [[r]] = await db.query<Row[]>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(Code, ?) AS UNSIGNED)), 0) AS n FROM ${table} WHERE Code LIKE ? FOR UPDATE`, [prefix.length + 1, `${prefix}%`]);
  return `${prefix}${String(Number(r?.['n'] ?? 0) + 1).padStart(2, '0')}`;
}

// ── Reading ──────────────────────────────────────────────────────────────────────────────────────

const SUB_SQL = `
  SELECT d.DepartmentID, d.Code, d.DepartmentName, d.DepartmentDescription, d.DepartmentStatus, d.IsDepartmentTeam, d.PrimaryDepartmentId,
         d.DepartmentCreateTime, d.DepartmentModifyTime, d.ExecutiveLeaderID, el.UserName AS ELName, d.FunctionalLeaderID, fl.UserName AS FLName,
         (SELECT COUNT(*) FROM DepartmentUser du JOIN Users u ON u.UserID = du.UserID WHERE du.DepartmentID = d.DepartmentID AND u.IsUserArchived = 0) AS People,
         (SELECT COUNT(*) FROM DepartmentUser du JOIN Users u ON u.UserID = du.UserID WHERE du.DepartmentID = d.DepartmentID AND u.IsUserArchived = 0 AND u.UserStatus = 1) AS ActivePeople,
         (SELECT COUNT(*) FROM DepartmentTask t WHERE t.DepartmentID = d.DepartmentID AND t.IsActive = 1) AS Tasks,
         (SELECT COUNT(*) FROM DepartmentTarget t WHERE t.DepartmentID = d.DepartmentID AND t.IsActive = 1) AS Targets,
         (SELECT COUNT(*) FROM departmentgoal g WHERE g.DepartmentID = d.DepartmentID AND g.IsActive = 1) AS Goals
    FROM Department d
    LEFT JOIN Users el ON el.UserID = d.ExecutiveLeaderID
    LEFT JOIN Users fl ON fl.UserID = d.FunctionalLeaderID
   WHERE d.IsDepartmentArchived = 0`;

const subOf = (r: Row) => ({
  id: Number(r['DepartmentID']), code: (r['Code'] as string) ?? null, name: r['DepartmentName'] as string, description: (r['DepartmentDescription'] as string) ?? '',
  active: Number(r['DepartmentStatus']) === 1, isTeam: Number(r['IsDepartmentTeam']) === 1,
  departmentId: r['PrimaryDepartmentId'] == null ? null : Number(r['PrimaryDepartmentId']),
  el: ref(r['ExecutiveLeaderID'], r['ELName']), fl: ref(r['FunctionalLeaderID'], r['FLName']),
  people: Number(r['People']), activePeople: Number(r['ActivePeople']),
  tasks: Number(r['Tasks']), targets: Number(r['Targets']), goals: Number(r['Goals']),
  createdAt: day(r['DepartmentCreateTime']), changedAt: r['DepartmentModifyTime'] ?? null,
});
export type SubDepartment = ReturnType<typeof subOf>;

const deptOf = (r: Row, subs: SubDepartment[]) => {
  const own = subs.filter((s) => s.departmentId === Number(r['PrimaryDepartmentId']));
  return {
    id: Number(r['PrimaryDepartmentId']), code: (r['Code'] as string) ?? null, name: r['PrimaryDepartmentName'] as string,
    type: (r['Type'] as string) ?? null, goalCriteria: (r['GoalCriteria'] as string) ?? null, targetCriteria: (r['TargetCriteria'] as string) ?? null,
    description: (r['Description'] as string) ?? '', active: Number(r['IsActive']) === 1, createdAt: day(r['CreatedAt']),
    // a department made without sub departments shows its one team as itself
    singleTeam: own.length === 1 && own[0]!.isTeam,
    subDepartments: own.length, people: own.reduce((n, s) => n + s.people, 0), activePeople: own.reduce((n, s) => n + s.activePeople, 0),
    tasks: own.reduce((n, s) => n + s.tasks, 0), targets: own.reduce((n, s) => n + s.targets, 0), goals: own.reduce((n, s) => n + s.goals, 0),
  };
};
export type Department = ReturnType<typeof deptOf>;

async function subs(where = '', params: unknown[] = []) {
  const [rows] = await pool.query<Row[]>(`${SUB_SQL} ${where} ORDER BY d.Code IS NULL, d.Code, d.DepartmentName`, params);
  return rows.map(subOf);
}

/** Every department and sub department with their counts (the list, table and hierarchy views) */
export async function overview() {
  const all = await subs();
  const [rows] = await pool.query<Row[]>('SELECT * FROM PrimaryDepartment ORDER BY Code IS NULL, Code, PrimaryDepartmentId');
  return { departments: rows.map((r) => deptOf(r, all)), subDepartments: all };
}

const PERSON_SQL = `
  SELECT du.DepartmentID, u.UserID, u.UserName, u.UserEmail, u.EmployeeID, u.UserStatus, u.Designation, u.UserRole, u.AppraisalCycle,
         DATE_FORMAT(u.DateOfJoining, '%Y-%m-%d') AS Joined, r.RoleName, r.UserType, rm.UserID AS RMID, rm.UserName AS RMName
    FROM DepartmentUser du
    JOIN Users u ON u.UserID = du.UserID AND u.IsUserArchived = 0
    LEFT JOIN AMRole r ON r.RoleID = u.RoleID
    LEFT JOIN Users rm ON rm.UserID = u.ReportingManagerID`;

async function people(subIds: number[]) {
  if (!subIds.length) return [];
  const [rows] = await pool.query<Row[]>(`${PERSON_SQL} WHERE du.DepartmentID IN (?) ORDER BY u.UserStatus DESC, u.UserName`, [subIds]);
  return rows.map((r) => ({
    userId: Number(r['UserID']), name: r['UserName'] as string, email: r['UserEmail'] as string, employeeId: (r['EmployeeID'] as string) || null,
    designation: (r['Designation'] as string) || null, roleName: (r['RoleName'] as string) ?? null, userType: (r['UserType'] as string) ?? null,
    userRole: (r['UserRole'] as string) ?? null, subDepartmentId: Number(r['DepartmentID']), reportsTo: ref(r['RMID'], r['RMName']),
    active: Number(r['UserStatus']) === 1, joined: (r['Joined'] as string) ?? null, appraisalCycle: (r['AppraisalCycle'] as string) ?? null,
  }));
}

/** A department: its sub departments and everyone in them */
export async function department(id: number) {
  const [[row]] = await pool.query<Row[]>('SELECT * FROM PrimaryDepartment WHERE PrimaryDepartmentId = ?', [id]);
  if (!row) throw AppError.notFound('Department not found');
  const own = await subs('AND d.PrimaryDepartmentId = ?', [id]);
  return { department: deptOf(row, own), subDepartments: own, people: await people(own.map((s) => s.id)) };
}

/** A sub department: its department and its people */
export async function subDepartment(id: number) {
  const [sub] = await subs('AND d.DepartmentID = ?', [id]);
  if (!sub) throw AppError.notFound('Sub department not found');
  let parent: Department | null = null;
  if (sub.departmentId) {
    const [[row]] = await pool.query<Row[]>('SELECT * FROM PrimaryDepartment WHERE PrimaryDepartmentId = ?', [sub.departmentId]);
    if (row) parent = deptOf(row, await subs('AND d.PrimaryDepartmentId = ?', [sub.departmentId]));
  }
  return { subDepartment: sub, department: parent, people: await people([id]) };
}

// ── Checks ───────────────────────────────────────────────────────────────────────────────────────

async function userExists(db: Db, id: number | null | undefined) {
  if (id == null) return;
  const [r] = await db.query<Row[]>('SELECT 1 FROM Users WHERE UserID = ? AND IsUserArchived = 0', [id]);
  if (!r.length) throw AppError.badRequest('That person was not found');
}
async function departmentNameFree(db: Db, name: string, notId = 0) {
  const [r] = await db.query<Row[]>('SELECT 1 FROM PrimaryDepartment WHERE PrimaryDepartmentName = ? AND PrimaryDepartmentId <> ?', [name, notId]);
  if (r.length) throw AppError.conflict(`A department called "${name}" already exists`);
}
async function subNameFree(db: Db, name: string, notId = 0) {
  const [r] = await db.query<Row[]>('SELECT 1 FROM Department WHERE DepartmentName = ? AND DepartmentID <> ? AND IsDepartmentArchived = 0', [name, notId]);
  if (r.length) throw AppError.conflict(`A sub department called "${name}" already exists`);
}
async function activePeopleIn(db: Db, subId: number) {
  const [[r]] = await db.query<Row[]>(
    'SELECT COUNT(*) AS n FROM DepartmentUser du JOIN Users u ON u.UserID = du.UserID WHERE du.DepartmentID = ? AND u.UserStatus = 1 AND u.IsUserArchived = 0', [subId]);
  return Number(r?.['n'] ?? 0);
}

// ── Departments ──────────────────────────────────────────────────────────────────────────────────

export interface SubInput { name: string; elId?: number | null; flId?: number | null; description?: string | null }
export interface DepartmentInput {
  name: string; type: (typeof TYPES)[number]; goalCriteria: (typeof CRITERIA)[number]; targetCriteria: (typeof CRITERIA)[number]; description?: string | null;
  /** with sub departments: these; without: the department's own EL / FL lead its one team */
  subDepartments?: SubInput[] | null; elId?: number | null; flId?: number | null;
}

async function insertSub(db: Db, departmentId: number | null, s: SubInput, team = false) {
  const name = s.name.trim();
  if (name.length < 2) throw AppError.badRequest('Give each sub department a name');
  await subNameFree(db, name);
  await userExists(db, s.elId); await userExists(db, s.flId);
  const code = await nextCode(db, 'SD');
  const [r] = await db.execute<mysql.ResultSetHeader>(
    `INSERT INTO Department (DepartmentName, DepartmentDescription, DepartmentCreateTime, DepartmentModifyTime, ExecutiveLeaderID, FunctionalLeaderID,
                             PrimaryDepartmentId, DepartmentStatus, IsDepartmentArchived, Code, IsDepartmentTeam)
     VALUES (?, ?, NOW(), NOW(), ?, ?, ?, 1, 0, ?, ?)`,
    [name, s.description?.trim() || null, s.elId ?? null, s.flId ?? null, departmentId, code, team ? 1 : 0]);
  return { id: r.insertId, code };
}

export async function createDepartment(input: DepartmentInput) {
  const name = input.name.trim();
  return tx(async (c) => {
    await departmentNameFree(c, name);
    const code = await nextCode(c, 'D');
    const [r] = await c.execute<mysql.ResultSetHeader>(
      'INSERT INTO PrimaryDepartment (PrimaryDepartmentName, Type, IsActive, GoalCriteria, TargetCriteria, Code, Description) VALUES (?, ?, 1, ?, ?, ?, ?)',
      [name, input.type, input.goalCriteria, input.targetCriteria, code, input.description?.trim() || null]);
    const id = r.insertId;
    const made = [];
    if (input.subDepartments?.length) {
      const names = input.subDepartments.map((s) => s.name.trim().toLowerCase());
      if (new Set(names).size !== names.length) throw AppError.badRequest('Two sub departments have the same name');
      for (const s of input.subDepartments) made.push(await insertSub(c, id, s));
    } else {
      made.push(await insertSub(c, id, { name, elId: input.elId, flId: input.flId, description: input.description }, true));
    }
    return { id, code, subDepartments: made };
  });
}

export async function updateDepartment(id: number, input: Partial<DepartmentInput> & { active?: boolean }) {
  const [[row]] = await pool.query<Row[]>('SELECT * FROM PrimaryDepartment WHERE PrimaryDepartmentId = ?', [id]);
  if (!row) throw AppError.notFound('Department not found');
  const sets: string[] = []; const params: unknown[] = [];
  if (input.name !== undefined) {
    const name = input.name.trim();
    await departmentNameFree(pool, name, id);
    sets.push('PrimaryDepartmentName = ?'); params.push(name);
    // the one team of a single-team department carries the department's name
    const [team] = await pool.query<Row[]>('SELECT DepartmentID FROM Department WHERE PrimaryDepartmentId = ? AND IsDepartmentArchived = 0', [id]);
    const [flag] = await pool.query<Row[]>('SELECT DepartmentID FROM Department WHERE PrimaryDepartmentId = ? AND IsDepartmentArchived = 0 AND IsDepartmentTeam = 1', [id]);
    if (team.length === 1 && flag.length === 1 && name !== row['PrimaryDepartmentName']) {
      await subNameFree(pool, name, flag[0]!['DepartmentID'] as number);
      await pool.execute('UPDATE Department SET DepartmentName = ?, DepartmentModifyTime = NOW() WHERE DepartmentID = ?', [name, flag[0]!['DepartmentID']]);
    }
  }
  if (input.type !== undefined) { sets.push('Type = ?'); params.push(input.type); }
  if (input.goalCriteria !== undefined) { sets.push('GoalCriteria = ?'); params.push(input.goalCriteria); }
  if (input.targetCriteria !== undefined) { sets.push('TargetCriteria = ?'); params.push(input.targetCriteria); }
  if (input.description !== undefined) { sets.push('Description = ?'); params.push(input.description?.trim() || null); }
  if (input.active !== undefined) { sets.push('IsActive = ?'); params.push(input.active ? 1 : 0); }
  if (sets.length) await pool.query(`UPDATE PrimaryDepartment SET ${sets.join(', ')}, UpdatedAt = NOW() WHERE PrimaryDepartmentId = ?`, [...params, id]);
  return { id };
}

// ── Sub departments ──────────────────────────────────────────────────────────────────────────────

/** Puts people in a sub department. A person belongs to one sub department, so they leave any other. */
async function movePeople(db: Db, subId: number, userIds: number[]) {
  for (const uid of [...new Set(userIds)]) {
    await userExists(db, uid);
    await db.execute('DELETE FROM DepartmentUser WHERE UserID = ? AND DepartmentID <> ?', [uid, subId]);
    await db.execute('INSERT IGNORE INTO DepartmentUser (DepartmentID, UserID) VALUES (?, ?)', [subId, uid]);
  }
}

/** Copies the active tasks, targets and goals of one sub department into another (goals wait for the EL again) */
async function copyData(db: Db, from: number, to: number) {
  const copied = { tasks: 0, targets: 0, goals: 0 };
  for (const [table, key] of [['DepartmentTask', 'tasks'], ['DepartmentTarget', 'targets'], ['departmentgoal', 'goals']] as const) {
    const [cols] = await db.query<Row[]>(`SHOW COLUMNS FROM ${table}`);
    const names = cols.filter((c) => c['Key'] !== 'PRI').map((c) => c['Field'] as string);
    const pick = names.map((n) => (n === 'DepartmentID' ? '?' : /^(CreatedAt|ModifiedAt)$/.test(n) ? 'NOW()' : n === 'approvedByEL' ? '0' : n));
    const [r] = await db.query<mysql.ResultSetHeader>(
      `INSERT INTO ${table} (${names.join(', ')}) SELECT ${pick.join(', ')} FROM ${table} WHERE DepartmentID = ? AND IsActive = 1`, [to, from]);
    copied[key] = r.affectedRows;
  }
  return copied;
}

export interface NewSubInput extends SubInput { departmentId: number | null; people?: number[]; copyFrom?: number | null }

export async function createSubDepartment(input: NewSubInput) {
  return tx(async (c) => {
    if (input.departmentId != null) {
      const [d] = await c.query<Row[]>('SELECT 1 FROM PrimaryDepartment WHERE PrimaryDepartmentId = ?', [input.departmentId]);
      if (!d.length) throw AppError.notFound('Department not found');
    }
    const made = await insertSub(c, input.departmentId, input);
    if (input.people?.length) await movePeople(c, made.id, input.people);
    const copied = input.copyFrom ? await copyData(c, input.copyFrom, made.id) : null;
    // once a single-team department gets a second sub department, its team is shown as a sub department like the others
    return { ...made, copied };
  });
}

export async function updateSubDepartment(id: number, input: { name?: string; description?: string | null; elId?: number | null; flId?: number | null; departmentId?: number | null; active?: boolean }) {
  const [[row]] = await pool.query<Row[]>('SELECT * FROM Department WHERE DepartmentID = ? AND IsDepartmentArchived = 0', [id]);
  if (!row) throw AppError.notFound('Sub department not found');
  const sets: string[] = []; const params: unknown[] = [];
  if (input.name !== undefined) { const n = input.name.trim(); if (n.length < 2) throw AppError.badRequest('Give the sub department a name'); await subNameFree(pool, n, id); sets.push('DepartmentName = ?'); params.push(n); }
  if (input.description !== undefined) { sets.push('DepartmentDescription = ?'); params.push(input.description?.trim() || null); }
  if (input.elId !== undefined) { await userExists(pool, input.elId); sets.push('ExecutiveLeaderID = ?'); params.push(input.elId); }
  if (input.flId !== undefined) { await userExists(pool, input.flId); sets.push('FunctionalLeaderID = ?'); params.push(input.flId); }
  if (input.departmentId !== undefined) {
    if (input.departmentId != null) {
      const [d] = await pool.query<Row[]>('SELECT 1 FROM PrimaryDepartment WHERE PrimaryDepartmentId = ?', [input.departmentId]);
      if (!d.length) throw AppError.notFound('Department not found');
    }
    sets.push('PrimaryDepartmentId = ?', 'IsDepartmentTeam = 0'); params.push(input.departmentId);
  }
  if (input.active !== undefined) {
    if (!input.active) { const n = await activePeopleIn(pool, id); if (n) throw AppError.conflict(`${n} active ${n === 1 ? 'person works' : 'people work'} here. Move them to another sub department first.`); }
    sets.push('DepartmentStatus = ?'); params.push(input.active ? 1 : 0);
  }
  if (sets.length) await pool.query(`UPDATE Department SET ${sets.join(', ')}, DepartmentModifyTime = NOW() WHERE DepartmentID = ?`, [...params, id]);
  return { id };
}

/** Removes a sub department (it is archived; its ID is not given again). Only when nobody active works there. */
export async function removeSubDepartment(id: number) {
  const n = await activePeopleIn(pool, id);
  if (n) throw AppError.conflict(`${n} active ${n === 1 ? 'person works' : 'people work'} here. Move them to another sub department first.`);
  const [r] = await pool.execute<mysql.ResultSetHeader>('UPDATE Department SET IsDepartmentArchived = 1, DepartmentModifyTime = NOW() WHERE DepartmentID = ? AND IsDepartmentArchived = 0', [id]);
  if (!r.affectedRows) throw AppError.notFound('Sub department not found');
  return { id };
}

export async function addPeople(subId: number, userIds: number[]) {
  const [s] = await pool.query<Row[]>('SELECT 1 FROM Department WHERE DepartmentID = ? AND IsDepartmentArchived = 0', [subId]);
  if (!s.length) throw AppError.notFound('Sub department not found');
  await tx((c) => movePeople(c, subId, userIds));
  return { subDepartmentId: subId, added: userIds.length };
}

/** Places older sub departments (under no department) in a department */
export async function mapSubDepartments(items: { subDepartmentId: number; departmentId: number }[]) {
  await tx(async (c) => {
    for (const i of items) {
      const [d] = await c.query<Row[]>('SELECT 1 FROM PrimaryDepartment WHERE PrimaryDepartmentId = ?', [i.departmentId]);
      if (!d.length) throw AppError.notFound('Department not found');
      await c.execute('UPDATE Department SET PrimaryDepartmentId = ?, IsDepartmentTeam = 0, DepartmentModifyTime = NOW() WHERE DepartmentID = ? AND IsDepartmentArchived = 0', [i.departmentId, i.subDepartmentId]);
    }
  });
  return { mapped: items.length };
}
