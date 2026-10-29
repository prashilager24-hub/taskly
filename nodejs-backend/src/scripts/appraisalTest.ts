/**
 * Developer tool for trying the Appraisal module by switching users. Never runs in production.
 *
 *   npx tsx src/scripts/appraisalTest.ts seed              create the "Appraisal Cycle Test" department, its EL, FL, 3 associates, Finance and HR, and start the first associate's cycle
 *   npx tsx src/scripts/appraisalTest.ts status            where each test cycle is
 *   npx tsx src/scripts/appraisalTest.ts start <email>     start a cycle today for a test person
 *   npx tsx src/scripts/appraisalTest.ts advance <email> <assessor|finance|return>
 *        assessor : employee window over, assessors' window open (day 16)
 *        finance  : assessors' window over, with Finance (day 31)
 *        return   : a postponed offer comes back to the assessors
 *   npx tsx src/scripts/appraisalTest.ts reset [name]      delete all test cycles (and the test budget), or one person's cycle, e.g. reset emp1 (people stay)
 *   npx tsx src/scripts/appraisalTest.ts reset-budget      clear the test department's budget and allocations
 *   npx tsx src/scripts/appraisalTest.ts remove            delete the cycles, people, department and roles
 *
 * Test people are appraisal.*@tapmind.test, password Test@12345. Seeding also writes PMS quarterly reviews for the three associates (Part A reads them).
 */
import bcrypt from 'bcryptjs';
import type mysql from 'mysql2/promise';
import { pool } from '../config/db';
import { env } from '../config/env';
import { runAppraisalCycle } from '../jobs/appraisalCycle';
import { addDays, todayIST, type EmployeeLevel } from '../modules/appraisal/appraisal.calc';
import { insertCycle } from '../modules/appraisal/appraisal.service';

type Row = mysql.RowDataPacket;
const PASSWORD = 'Test@12345';
const DEPT = 'Appraisal Cycle Test';
const EMAIL_LIKE = 'appraisal.%@tapmind.test';

const PEOPLE: { key: string; name: string; role: 'EL' | 'FL' | 'EMP' | 'Finance' | 'HR'; level: EmployeeLevel; joined: string | null; ctc: number | null }[] = [
  { key: 'el', name: 'Appraisal Test EL', role: 'EL', level: 'HEAD_EL', joined: '2021-03-01', ctc: 3000000 },
  { key: 'fl', name: 'Appraisal Test FL', role: 'FL', level: 'MANAGER', joined: '2022-06-01', ctc: 1800000 },
  { key: 'emp1', name: 'Appraisal Test Associate 1', role: 'EMP', level: 'ASSOCIATE', joined: '2024-02-10', ctc: 600000 },
  { key: 'emp2', name: 'Appraisal Test Associate 2', role: 'EMP', level: 'ASSOCIATE', joined: '2024-05-20', ctc: 540000 },
  { key: 'emp3', name: 'Appraisal Test Associate 3', role: 'EMP', level: 'ASSOCIATE', joined: '2025-01-15', ctc: 480000 },
  { key: 'finance', name: 'Appraisal Test Finance', role: 'Finance', level: 'ASSOCIATE', joined: null, ctc: null },
  { key: 'hr', name: 'Appraisal Test HR', role: 'HR', level: 'ASSOCIATE', joined: null, ctc: null },
];
const email = (key: string) => `appraisal.${key}@tapmind.test`;

async function ensureRole(name: string, privileges: object): Promise<number> {
  const [rows] = await pool.execute<Row[]>('SELECT RoleID FROM AMRole WHERE RoleName = ? AND IsRoleArchived = 0', [name]);
  if (rows[0]) return rows[0]['RoleID'] as number;
  const [res] = await pool.execute<mysql.ResultSetHeader>(
    'INSERT INTO AMRole (RoleName, RolePrivileges, RoleStatus, IsRoleArchived, RoleDescription, RoleCreateTime, RoleModifyTime) VALUES (?, ?, 1, 0, ?, NOW(), NOW())',
    [name, JSON.stringify(privileges), `${name} (appraisal test)`]);
  return res.insertId;
}

async function userId(key: string): Promise<number> {
  const [r] = await pool.execute<Row[]>('SELECT UserID FROM Users WHERE UserEmail = ? AND IsUserArchived = 0', [email(key)]);
  if (!r[0]) throw new Error(`${email(key)} does not exist. Run seed first.`);
  return r[0]['UserID'] as number;
}

async function seed() {
  const financeRole = await ensureRole('Finance', { appraisal: ['read'], dashboard: ['read'] });
  const hrRole = await ensureRole('HR', { appraisal: ['read'], dashboard: ['read'] });
  const roleId = { EL: 3, FL: 4, EMP: 2, Finance: financeRole, HR: hrRole };
  const hash = await bcrypt.hash(PASSWORD, 10);
  const id: Record<string, number> = {};

  for (const p of PEOPLE) {
    const [ex] = await pool.execute<Row[]>('SELECT UserID FROM Users WHERE UserEmail = ?', [email(p.key)]);
    if (ex[0]) { id[p.key] = ex[0]['UserID'] as number; continue; }
    const [res] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO Users (UserEmail, UserName, UserPassword, RoleID, UserStatus, IsUserArchived, EmployeeLevel, DateOfJoining, CurrentAnnualCtc, UserCreateTime, UserModifyTime, UserPasswordExpiryDate)
       VALUES (?, ?, ?, ?, 1, 0, ?, ?, ?, NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR))`, [email(p.key), p.name, hash, roleId[p.role], p.level, p.joined, p.ctc]);
    id[p.key] = res.insertId;
  }
  // reporting lines: FL reports to the EL; associates have the FL as manager and the EL as EL manager
  await pool.execute('UPDATE Users SET ELManagerID = ? WHERE UserID = ?', [id['el'], id['fl']]);
  for (const k of ['emp1', 'emp2', 'emp3']) await pool.execute('UPDATE Users SET ReportingManagerID = ?, ELManagerID = ? WHERE UserID = ?', [id['fl'], id['el'], id[k]]);

  let [d] = await pool.execute<Row[]>('SELECT DepartmentID FROM Department WHERE DepartmentName = ?', [DEPT]);
  let deptId = d[0]?.['DepartmentID'] as number | undefined;
  if (!deptId) {
    const [pd] = await pool.execute<Row[]>("SELECT PrimaryDepartmentId FROM PrimaryDepartment WHERE IsActive = 1 ORDER BY PrimaryDepartmentId LIMIT 1");
    const [res] = await pool.execute<mysql.ResultSetHeader>(
      'INSERT INTO Department (DepartmentName, ExecutiveLeaderID, FunctionalLeaderID, DepartmentStatus, IsDepartmentArchived, DepartmentDescription, PrimaryDepartmentId) VALUES (?, ?, ?, 1, 0, ?, ?)',
      [DEPT, id['el'], id['fl'], 'Throwaway department for trying the Appraisal module', pd[0]?.['PrimaryDepartmentId'] ?? null]);
    deptId = res.insertId;
  }
  await pool.execute('UPDATE Department SET ExecutiveLeaderID = ?, FunctionalLeaderID = ? WHERE DepartmentID = ?', [id['el'], id['fl'], deptId]);
  for (const k of ['el', 'fl', 'emp1', 'emp2', 'emp3']) await pool.execute('INSERT IGNORE INTO DepartmentUser (DepartmentID, UserID) VALUES (?, ?)', [deptId, id[k]]);

  for (const k of ['emp1', 'emp2', 'emp3']) await seedPms(id[k]!, k);
  const first = await startCycle(id['emp1']!);
  console.log(JSON.stringify({ departmentId: deptId, financeRoleId: financeRole, hrRoleId: hrRole, users: id, emp1Cycle: first }, null, 1));
  console.log(`\nAPPRAISAL_FINANCE_ROLE_IDS=${financeRole}   APPRAISAL_HR_ROLE_IDS=${hrRole}   (in nodejs-backend/.env, then restart the backend)`);
  console.log(`configured now: finance=[${env.APPRAISAL_FINANCE_ROLE_IDS}] hr=[${env.APPRAISAL_HR_ROLE_IDS}]`);
}

/** Four PMS quarterly reviews (Q4 2025 to Q3 2026) so Part A of the appraisal has data to show. Numbers differ a little per person. */
async function seedPms(uid: number, key: string) {
  const bump = key === 'emp1' ? 0 : key === 'emp2' ? -8 : 6;
  const quarters = [
    { q: 'Q4', y: 2025, s: '2025-10-01', e: '2025-12-31', t: 82, g: 76, u: 71, ef: 96, sg: 7, mr: 6.2 },
    { q: 'Q1', y: 2026, s: '2026-01-01', e: '2026-03-31', t: 88, g: 81, u: 74, ef: 99, sg: 8, mr: 6.8 },
    { q: 'Q2', y: 2026, s: '2026-04-01', e: '2026-06-30', t: 93, g: 85, u: 78, ef: 103, sg: 8, mr: 7.1 },
    { q: 'Q3', y: 2026, s: '2026-07-01', e: '2026-09-30', t: 97, g: 90, u: 80, ef: 105, sg: 9, mr: 7.6 },
  ];
  await pool.execute('DELETE FROM quarterlyreview WHERE emp_id = ?', [uid]);
  for (const x of quarters) {
    const target = x.t + bump, goal = x.g + bump;
    const final = Math.round(((target * 0.4 + goal * 0.6) / 10) * 100) / 100;
    const label = final >= 8.5 ? 'Exceeds Expectations' : final >= 7 ? 'Meets Expectations' : 'Approaching Expectations';
    await pool.execute(
      `INSERT INTO quarterlyreview SET emp_id = ?, quarter = ?, quarter_year = ?, quarter_start_date = ?, quarter_end_date = ?, target_percent = ?, goal_achievement = ?, utilization_percent = ?,
         efficiency_percent = ?, efficiency_label = ?, system_grade = ?, manager_avg_rating = ?, final_rating = ?, manager_ratings = ?, feedback = ?, status = 'On Track', grade = ?, created_at = NOW(), updated_at = NOW()`,
      [uid, x.q, x.y, x.s, x.e, target, goal, x.u, x.ef, x.ef >= 100 ? 'High' : 'At Par', x.sg, x.mr, final, '{}',
        JSON.stringify([{ feedbackCat: 'Meets Expectations', feedbackType: 'Productivity', feedback: `${x.q} ${x.y}: steady delivery, good ownership of the sprint goals.` }]),
        JSON.stringify([{ finalGrade: final, finalGradeLabel: label, starRating: 0, starDescription: '', goalWeight: 60, targetWeight: 40 }])]);
  }
}

async function startCycle(uid: number) {
  const [u] = await pool.execute<Row[]>('SELECT UserID, EmployeeLevel, CurrentAnnualCtc FROM Users WHERE UserID = ?', [uid]);
  const today = todayIST();
  const [have] = await pool.execute<Row[]>('SELECT CycleID FROM AppraisalCycle WHERE UserID = ? AND CycleYear = ?', [uid, Number(today.slice(0, 4))]);
  if (have[0]) return { cycleId: have[0]['CycleID'], note: 'already had one' };
  const cid = await insertCycle(pool, u[0] as never, today, null);
  return { cycleId: cid, start: today };
}

async function latestCycle(key: string) {
  const uid = await userId(key.replace(/^appraisal\.|@tapmind\.test$/g, ''));
  const [c] = await pool.execute<Row[]>('SELECT CycleID, Status FROM AppraisalCycle WHERE UserID = ? ORDER BY CycleStartDate DESC, CycleID DESC LIMIT 1', [uid]);
  if (!c[0]) throw new Error('That person has no cycle. Use: start <email>');
  return c[0]['CycleID'] as number;
}

async function advance(who: string, stage: string) {
  const id = await latestCycle(who);
  const today = todayIST();
  if (stage === 'assessor' || stage === 'finance') {
    const start = addDays(today, stage === 'assessor' ? -15 : -30);
    await pool.execute('UPDATE AppraisalCycle SET CycleStartDate = ?, EmployeeWindowEnd = ?, AssessorWindowEnd = ? WHERE CycleID = ? AND Status IN (\'EMPLOYEE_OPEN\', \'ASSESSOR_OPEN\')', [start, addDays(start, 14), addDays(start, 29), id]);
  } else if (stage === 'return') {
    await pool.execute("UPDATE AppraisalCycle SET PostponedUntil = ? WHERE CycleID = ? AND Status = 'POSTPONED'", [addDays(today, -1), id]);
  } else throw new Error('Stage must be assessor, finance or return');
  console.log(JSON.stringify(await runAppraisalCycle()));
  await status();
}

async function status() {
  const [r] = await pool.execute<Row[]>(
    `SELECT u.UserEmail, c.CycleID, c.Status, DATE_FORMAT(c.CycleStartDate,'%Y-%m-%d') AS start, DATE_FORMAT(c.AssessorWindowEnd,'%Y-%m-%d') AS assessorEnd, DATE_FORMAT(c.PostponedUntil,'%Y-%m-%d') AS postponedUntil
       FROM AppraisalCycle c JOIN Users u ON u.UserID = c.UserID WHERE u.UserEmail LIKE ? ORDER BY c.CycleID`, [EMAIL_LIKE]);
  console.table(r.map((x) => ({ ...x })));
}

async function reset(who?: string) {
  const like = who ? email(who.replace(/^appraisal\.|@tapmind\.test$/g, '')) : EMAIL_LIKE;
  await pool.execute('DELETE FROM AppraisalAudit WHERE CycleID IN (SELECT CycleID FROM AppraisalCycle WHERE UserID IN (SELECT UserID FROM Users WHERE UserEmail LIKE ?))', [like]);
  const [res] = await pool.execute<mysql.ResultSetHeader>('DELETE FROM AppraisalCycle WHERE UserID IN (SELECT UserID FROM Users WHERE UserEmail LIKE ?)', [like]);
  if (!who) await pool.execute('DELETE FROM AppraisalBudget WHERE DepartmentID IN (SELECT DepartmentID FROM Department WHERE DepartmentName = ?)', [DEPT]).then(() => pool.execute('DELETE FROM AppraisalBudgetAlloc WHERE DepartmentID IN (SELECT DepartmentID FROM Department WHERE DepartmentName = ?)', [DEPT]));
  console.log(`deleted ${res.affectedRows} cycles${who ? '' : ' and the test budget'}`);
}

async function remove() {
  await reset();
  await pool.execute('DELETE FROM quarterlyreview WHERE emp_id IN (SELECT UserID FROM Users WHERE UserEmail LIKE ?)', [EMAIL_LIKE]);
  await pool.execute('DELETE FROM DepartmentUser WHERE DepartmentID IN (SELECT DepartmentID FROM Department WHERE DepartmentName = ?)', [DEPT]);
  await pool.execute('DELETE FROM Department WHERE DepartmentName = ?', [DEPT]);
  await pool.execute('DELETE FROM UserSession WHERE UserID IN (SELECT UserID FROM Users WHERE UserEmail LIKE ?)', [EMAIL_LIKE]).catch(() => undefined);
  await pool.execute('DELETE FROM Users WHERE UserEmail LIKE ?', [EMAIL_LIKE]);
  await pool.execute("DELETE FROM AMRole WHERE RoleDescription LIKE '%(appraisal test)'");
  console.log('removed the test department, people and roles');
}

(async () => {
  if (env.NODE_ENV === 'production') throw new Error('This tool never runs in production');
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'seed') await seed();
  else if (cmd === 'status') await status();
  else if (cmd === 'start') { console.log(await startCycle(await userId((a ?? '').replace(/^appraisal\.|@tapmind\.test$/g, '')))); await status(); }
  else if (cmd === 'advance') await advance(a ?? '', b ?? '');
  else if (cmd === 'reset') await reset(a);
  else if (cmd === 'reset-budget') { await pool.execute('DELETE FROM AppraisalBudgetAlloc WHERE DepartmentID IN (SELECT DepartmentID FROM Department WHERE DepartmentName = ?)', [DEPT]); await pool.execute('DELETE FROM AppraisalBudget WHERE DepartmentID IN (SELECT DepartmentID FROM Department WHERE DepartmentName = ?)', [DEPT]); console.log('test budget cleared'); }
  else if (cmd === 'remove') await remove();
  else console.log('Commands: seed | status | start <email> | advance <email> <assessor|finance|return> | reset [name] | reset-budget | remove');
  process.exit(0);
})().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
