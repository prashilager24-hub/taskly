import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { AppError } from '../../utils/AppError';
import { logChange } from './access.service';

type Row = mysql.RowDataPacket;

/**
 * The reporting ladder, top to bottom:
 *   Admin (CEO / CBO)  ->  Executive Leader (EL)  ->  Functional Leader / Manager / Lead  ->  Employee  ->  Intern
 *
 * Each person is reviewed by up to two assessors:
 *   Employee / Intern  : accessor 1 = their Functional Leader / Manager, accessor 2 = their EL
 *   FL / Manager / Lead: accessor 1 = the EL of their department(s),      accessor 2 = CEO / CBO (optional)
 *   EL                 : accessor 1 = CEO / CBO,                           no accessor 2
 */
export type Level = 'admin' | 'el' | 'fl' | 'employee' | 'intern';

export const LEVELS: { key: Level; label: string; description: string }[] = [
  { key: 'admin', label: 'Admin (CEO / CBO)', description: 'Runs the company. Full access. Not reviewed.' },
  { key: 'el', label: 'Executive Leader', description: 'Leads departments. Reviewed by the CEO / CBO only.' },
  { key: 'fl', label: 'Functional Leader / Manager / Lead', description: 'Reviewed by their EL, and by the CEO / CBO if set.' },
  { key: 'employee', label: 'Employee', description: 'Reviewed by their manager, then their EL.' },
  { key: 'intern', label: 'Intern', description: 'Reviewed by their manager, then their EL.' },
];

// Role ids as used by the app: 1 Admin, 3 ExecutiveLeader, 4 FunctionalLeader, 7 Manager, 23 Lead, 2 normalUser, 6 Executive, 5 Intern
const LEVEL_OF_ROLE: Record<number, Level> = { 1: 'admin', 3: 'el', 4: 'fl', 7: 'fl', 23: 'fl', 2: 'employee', 6: 'employee', 5: 'intern' };
export const levelOf = (roleId: number): Level => LEVEL_OF_ROLE[roleId] ?? 'employee';

interface Person { userId: number; name: string; email: string; roleId: number; roleName: string; level: Level; active: boolean; reportingManagerId: number | null; elManagerId: number | null }
interface Dept { id: number; name: string; el: number | null; fl: number | null }
export interface Ref { userId: number; name: string; level: Level }
export interface Assessors { accessor1: Ref | null; accessor2: Ref | null; accessor1Optional: boolean; accessor2Allowed: boolean }

async function load() {
  const [users] = await pool.execute<Row[]>(
    `SELECT u.UserID, u.UserName, u.UserEmail, u.RoleID, r.RoleName, u.UserStatus, u.ReportingManagerID, u.ELManagerID
       FROM Users u LEFT JOIN AMRole r ON r.RoleID = u.RoleID WHERE u.IsUserArchived = 0`);
  const [depts] = await pool.execute<Row[]>(
    `SELECT DepartmentID, DepartmentName, ExecutiveLeaderID, FunctionalLeaderID FROM Department WHERE IsDepartmentArchived = 0 AND DepartmentStatus = 1`);
  const [members] = await pool.execute<Row[]>('SELECT UserID, DepartmentID FROM DepartmentUser');
  const [[setting]] = await pool.execute<Row[]>("SELECT SettingValue FROM AppSetting WHERE SettingKey = 'ceoUserId'");

  const people = new Map<number, Person>(users.map((u) => [u['UserID'] as number, {
    userId: u['UserID'], name: u['UserName'], email: u['UserEmail'], roleId: u['RoleID'], roleName: u['RoleName'] ?? '', level: levelOf(u['RoleID']),
    active: u['UserStatus'] === 1, reportingManagerId: u['ReportingManagerID'] ?? null, elManagerId: u['ELManagerID'] ?? null,
  }]));
  const departments = new Map<number, Dept>(depts.map((d) => [d['DepartmentID'] as number, { id: d['DepartmentID'], name: d['DepartmentName'], el: d['ExecutiveLeaderID'] ?? null, fl: d['FunctionalLeaderID'] ?? null }]));
  const deptsOf = new Map<number, number[]>();
  for (const m of members) deptsOf.set(m['UserID'], [...(deptsOf.get(m['UserID']) ?? []), m['DepartmentID']]);
  // a leader belongs to the departments they lead as well
  for (const d of departments.values()) for (const lead of [d.el, d.fl]) if (lead) { const l = deptsOf.get(lead) ?? []; if (!l.includes(d.id)) deptsOf.set(lead, [...l, d.id]); }

  // The CEO / CBO: chosen in Access Management, else the first real Admin account
  let ceoId: number | null = setting ? Number(setting['SettingValue']) || null : null;
  if (!ceoId || !people.get(ceoId)?.active) {
    ceoId = [...people.values()].filter((p) => p.level === 'admin' && p.active && !/^superadmin/i.test(p.email)).sort((a, b) => a.userId - b.userId)[0]?.userId ?? null;
  }
  return { people, departments, deptsOf, ceoId };
}

type Ctx = Awaited<ReturnType<typeof load>>;
const ref = (c: Ctx, id: number | null | undefined): Ref | null => {
  const p = id ? c.people.get(id) : undefined;
  return p && p.active ? { userId: p.userId, name: p.name, level: p.level } : null;
};

function assessorsFor(c: Ctx, p: Person): Assessors {
  const myDepts = (c.deptsOf.get(p.userId) ?? []).map((id) => c.departments.get(id)).filter((d): d is Dept => !!d);
  const firstEl = myDepts.map((d) => d.el).find((id) => id && id !== p.userId) ?? null;
  const firstFl = myDepts.map((d) => d.fl).find((id) => id && id !== p.userId) ?? null;
  const above = (id: number | null, ...levels: Level[]) => { const r = ref(c, id); return r && levels.includes(r.level) ? r : null; };

  switch (p.level) {
    case 'admin':
      return { accessor1: null, accessor2: null, accessor1Optional: true, accessor2Allowed: false };
    case 'el':
      // only the CEO / CBO reviews an EL
      return { accessor1: above(p.reportingManagerId, 'admin') ?? ref(c, c.ceoId), accessor2: null, accessor1Optional: false, accessor2Allowed: false };
    case 'fl':
      return { accessor1: above(p.elManagerId, 'el') ?? ref(c, firstEl), accessor2: above(p.reportingManagerId, 'admin'), accessor1Optional: false, accessor2Allowed: true };
    default:
      return {
        accessor1: above(p.reportingManagerId, 'fl', 'el') ?? ref(c, firstFl),
        accessor2: above(p.elManagerId, 'el') ?? ref(c, firstEl),
        accessor1Optional: false, accessor2Allowed: true,
      };
  }
}

export async function assessorsOf(userId: number) {
  const c = await load();
  const p = c.people.get(userId);
  if (!p) throw AppError.notFound('User not found');
  return { level: p.level, ...assessorsFor(c, p) };
}

export async function hierarchy() {
  const c = await load();
  const people = [...c.people.values()].filter((p) => p.active).map((p) => {
    const a = assessorsFor(c, p);
    const depts = (c.deptsOf.get(p.userId) ?? []).map((id) => c.departments.get(id)?.name).filter((n): n is string => !!n);
    const missing = p.level !== 'admin' && !a.accessor1;
    return { userId: p.userId, name: p.name, email: p.email, roleName: p.roleName, level: p.level, departments: depts, accessor1: a.accessor1, accessor2: a.accessor2, accessor2Allowed: a.accessor2Allowed, missing };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const levels = LEVELS.map((l) => ({ ...l, count: people.filter((p) => p.level === l.key).length }));
  return { levels, ceo: ref(c, c.ceoId), people, missing: people.filter((p) => p.missing).length };
}

export async function setCeo(actor: number, userId: number) {
  const [[u]] = await pool.execute<Row[]>('SELECT UserName, RoleID FROM Users WHERE UserID = ? AND IsUserArchived = 0', [userId]);
  if (!u) throw AppError.notFound('User not found');
  if (levelOf(u['RoleID']) !== 'admin') throw AppError.badRequest('The CEO / CBO must be an Admin account');
  await pool.execute("INSERT INTO AppSetting (SettingKey, SettingValue) VALUES ('ceoUserId', ?) ON DUPLICATE KEY UPDATE SettingValue = VALUES(SettingValue)", [String(userId)]);
  await logChange(actor, 'user', userId, `Set ${u['UserName']} as CEO / CBO`);
}
