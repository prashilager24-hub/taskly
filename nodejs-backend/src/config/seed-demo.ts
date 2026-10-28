/**
 * Demo data — 5–10 realistic rows in every module so each page has content to show.
 * Run after db:migrate and db:seed:   npm run db:seed:demo        (add --force to run again)
 * All demo users sign in with password  Employee@123  (admin keeps Admin@123).
 */
import bcrypt from 'bcryptjs';
import type mysql from 'mysql2/promise';
import { pool } from './db';

const MARKER = 'demo-data-v1';
const PASSWORD = 'Employee@123';

// Every module the sidebar knows (frontend accessRole.tsx MODULES + sidebar.tsx)
const ALL = ['read', 'create', 'update', 'delete'];
const priv = (mods: Record<string, string[]>) => JSON.stringify(mods);

/** Working days (Mon–Fri) going back from yesterday */
function workingDays(count: number): string[] {
  const days: string[] = [];
  const d = new Date();
  while (days.length < count) {
    d.setDate(d.getDate() - 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) days.push(d.toISOString().slice(0, 10));
  }
  return days.reverse();
}

/** Deterministic pseudo-random so a re-run with --force produces the same picture */
let seedState = 7;
const rand = () => ((seedState = (seedState * 9301 + 49297) % 233280) / 233280);
const between = (lo: number, hi: number) => Math.round(lo + rand() * (hi - lo));
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;

async function idsByEmail(emails: string[]) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT UserID, UserEmail FROM Users WHERE UserEmail IN (?)', [emails]);
  return new Map(rows.map((r) => [r['UserEmail'] as string, r['UserID'] as number]));
}

async function main() {
  const force = process.argv.includes('--force');
  await pool.query(`CREATE TABLE IF NOT EXISTS SchemaMigration (Name VARCHAR(255) NOT NULL PRIMARY KEY, AppliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  const [done] = await pool.query<mysql.RowDataPacket[]>('SELECT 1 FROM SchemaMigration WHERE Name = ?', [MARKER]);
  if (done.length && !force) {
    console.log('Demo data already loaded (use --force to load it again).');
    return;
  }
  console.log('🌱  Loading demo data…');
  const hash = await bcrypt.hash(PASSWORD, 10);

  // ── Roles: privilege maps the sidebar understands ───────────────────────────
  const employee = { dashboard: ['read'], reports: ['read'], perf: ['read'], mydata: ['read'], goals: ['read'], dataentry: ALL, pms: ['read', 'create', 'update'], hrfeedback: ['read', 'create'] };
  const leader = { ...employee, entryApproval: ALL, userHistory: ['read'], queryReport: ['read'], pms: ALL };
  await pool.query('UPDATE AMRole SET RolePrivileges = ?, RoleDescription = ? WHERE RoleID = 2', [priv(employee), 'Standard employee access']);
  await pool.query('UPDATE AMRole SET RolePrivileges = ?, RoleDescription = ? WHERE RoleID = 3', [priv(leader), 'Executive Leader — their departments']);
  await pool.query('UPDATE AMRole SET RolePrivileges = ?, RoleDescription = ? WHERE RoleID = 4', [priv(leader), 'Reporting Manager — direct reports']);
  await pool.query('UPDATE AMRole SET RolePrivileges = ?, RoleDescription = ? WHERE RoleID = 5', [priv({ ...employee, salesfwd: ALL }), 'Sales team']);
  console.log('  ✓ Role privileges');

  // ── People: readable names for the base seed users + new colleagues ────────
  const renames: [string, string][] = [
    ['admin@tapmind.com', 'Taskly Admin'], ['manager@tapmind.com', 'John Mathew'], ['emp1@tapmind.com', 'Priya Sharma'],
    ['emp2@tapmind.com', 'Rahul Verma'], ['emp3@tapmind.com', 'Anjali Nair'], ['hr@tapmind.com', 'Meera Krishnan'],
    ['sales1@tapmind.com', 'Arjun Kapoor'],
  ];
  for (const [email, name] of renames) await pool.query('UPDATE Users SET UserName = ? WHERE UserEmail = ?', [name, email]);

  const people: [string, string, number, string][] = [
    // email, name, role, employee id
    ['vikram.rao@tapmind.com', 'Vikram Rao', 3, 'EMP101'],
    ['sneha.iyer@tapmind.com', 'Sneha Iyer', 4, 'EMP102'],
    ['rohan.das@tapmind.com', 'Rohan Das', 2, 'EMP103'],
    ['neha.kapoor@tapmind.com', 'Neha Kapoor', 2, 'EMP104'],
    ['aditya.singh@tapmind.com', 'Aditya Singh', 2, 'EMP105'],
    ['pooja.nair@tapmind.com', 'Pooja Nair', 2, 'EMP106'],
    ['karan.malhotra@tapmind.com', 'Karan Malhotra', 5, 'EMP107'],
    ['isha.gupta@tapmind.com', 'Isha Gupta', 2, 'EMP108'],
  ];
  for (const [email, name, role, emp] of people) {
    await pool.query(
      `INSERT INTO Users (UserEmail, UserName, UserPassword, RoleID, UserStatus, IsUserArchived, EmployeeID, AppraisalCycle)
       SELECT ?, ?, ?, ?, 1, 0, ?, 'QUARTERLY' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM Users WHERE UserEmail = ?)`,
      [email, name, hash, role, emp, email],
    );
    await pool.query('UPDATE Users SET UserName = ?, RoleID = ? WHERE UserEmail = ?', [name, role, email]);
  }
  const id = await idsByEmail([...renames.map((r) => r[0]), ...people.map((p) => p[0])]);
  const u = (email: string) => id.get(email)!;
  const admin = u('admin@tapmind.com'), john = u('manager@tapmind.com'), vikram = u('vikram.rao@tapmind.com'), sneha = u('sneha.iyer@tapmind.com');
  console.log('  ✓ People');

  // ── Departments ────────────────────────────────────────────────────────────
  const newDepts: [string, string, number, number, number][] = [
    ['Quality Assurance', 'Test automation and release quality', vikram, sneha, 1],
    ['Account Management', 'Publisher and advertiser accounts', vikram, john, 2],
    ['Learning & Development', 'Training, certifications and onboarding', admin, u('hr@tapmind.com'), 3],
    ['Finance & Operations', 'Billing, invoicing and vendor operations', admin, john, 4],
  ];
  for (const [name, desc, el, fl, pd] of newDepts) {
    await pool.query(
      `INSERT INTO Department (DepartmentName, DepartmentDescription, ExecutiveLeaderID, FunctionalLeaderID, PrimaryDepartmentId, DepartmentStatus, IsDepartmentArchived, DepartmentCreateTime, DepartmentModifyTime)
       SELECT ?, ?, ?, ?, ?, 1, 0, NOW(), NOW() FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM Department WHERE DepartmentName = ?)`,
      [name, desc, el, fl, pd, name],
    );
  }
  await pool.query(`UPDATE Department SET DepartmentDescription = CASE DepartmentName
      WHEN 'Backend Engineering' THEN 'APIs, data pipelines and the ad server'
      WHEN 'Frontend Engineering' THEN 'Dashboards and publisher-facing apps'
      WHEN 'Sales Team' THEN 'New business and partnerships'
      WHEN 'Human Resources' THEN 'People operations and hiring' ELSE DepartmentDescription END,
      ExecutiveLeaderID = CASE WHEN DepartmentName IN ('Backend Engineering', 'Frontend Engineering') THEN ? ELSE ExecutiveLeaderID END`, [vikram]);
  const [deptRows] = await pool.query<mysql.RowDataPacket[]>('SELECT DepartmentID, DepartmentName FROM Department');
  const dept = new Map(deptRows.map((d) => [d['DepartmentName'] as string, d['DepartmentID'] as number]));
  const d = (name: string) => dept.get(name)!;

  // Who works where, and who they report to
  const placement: [string, string, number][] = [
    ['emp1@tapmind.com', 'Backend Engineering', john], ['emp2@tapmind.com', 'Backend Engineering', john],
    ['rohan.das@tapmind.com', 'Backend Engineering', john], ['emp3@tapmind.com', 'Frontend Engineering', john],
    ['neha.kapoor@tapmind.com', 'Frontend Engineering', john], ['aditya.singh@tapmind.com', 'Quality Assurance', sneha],
    ['pooja.nair@tapmind.com', 'Account Management', john], ['karan.malhotra@tapmind.com', 'Sales Team', john],
    ['isha.gupta@tapmind.com', 'Learning & Development', u('hr@tapmind.com')], ['sneha.iyer@tapmind.com', 'Quality Assurance', vikram],
  ];
  for (const [email, deptName, rm] of placement) {
    await pool.query('INSERT IGNORE INTO DepartmentUser (DepartmentID, UserID) VALUES (?, ?)', [d(deptName), u(email)]);
    await pool.query('UPDATE Users SET ReportingManagerID = ?, ELManagerID = ? WHERE UserID = ?', [rm, vikram, u(email)]);
  }
  console.log('  ✓ Departments and teams');

  // ── Tasks, targets, goals ───────────────────────────────────────────────────
  const tasks: [string, string, number, string][] = [
    ['Backend Engineering', 'API Development', 240, 'Daily'], ['Backend Engineering', 'Database Optimisation', 120, 'Weekly'],
    ['Frontend Engineering', 'Dashboard Widgets', 180, 'Daily'], ['Quality Assurance', 'Regression Testing', 180, 'Daily'],
    ['Quality Assurance', 'Test Case Review', 60, 'Weekly'], ['Account Management', 'Publisher Onboarding', 90, 'Daily'],
    ['Learning & Development', 'Training Session Prep', 120, 'Weekly'], ['Finance & Operations', 'Invoice Reconciliation', 150, 'Monthly'],
  ];
  for (const [deptName, name, mins, freq] of tasks) {
    await pool.query(
      `INSERT INTO DepartmentTask (DepartmentID, TaskName, StandardTimeMins, Frequency, IsDynamic, Description, IsForTarget, TargetNumber, IsActive)
       SELECT ?, ?, ?, ?, 0, ?, 0, 0, 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DepartmentTask WHERE TaskName = ? AND DepartmentID = ?)`,
      [d(deptName), name, mins, freq, `${name} for ${deptName}`, name, d(deptName)],
    );
  }
  await pool.query("UPDATE DepartmentTask SET IsForTarget = 0, Description = COALESCE(Description, CONCAT(TaskName, ' — standard work'))");

  const targets: [string, string, string, string, string][] = [
    ['Backend Engineering', 'Story points delivered', 'POINTS', '20', 'pts'], ['Frontend Engineering', 'Screens shipped', 'COUNT', '6', 'screens'],
    ['Quality Assurance', 'Test cases executed', 'COUNT', '120', 'cases'], ['Sales Team', 'Qualified demos booked', 'COUNT', '10', 'demos'],
    ['Account Management', 'Publishers activated', 'COUNT', '8', 'accounts'], ['Learning & Development', 'Training hours delivered', 'HOURS', '16', 'hrs'],
  ];
  for (const [deptName, name, metric, value, unit] of targets) {
    await pool.query(
      `INSERT INTO DepartmentTarget (DepartmentID, TargetName, TargetMetric, MetricValue, Unit, Frequency, IsDynamic, Description, IsActive, RoleID)
       SELECT ?, ?, ?, ?, ?, 'Weekly', 0, ?, 1, 2 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DepartmentTarget WHERE TargetName = ?)`,
      [d(deptName), name, metric, value, unit, `Weekly ${name.toLowerCase()}`, name],
    );
  }
  await pool.query('INSERT IGNORE INTO DepartmentTargetRole (TargetID, RoleID) SELECT TargetID, 2 FROM DepartmentTarget');

  const goals: [string, string, string, string, string][] = [
    ['Quality Assurance', 'Defect leakage below 2%', 'PERCENTAGE', '2', '%'], ['Account Management', 'Account retention', 'PERCENTAGE', '95', '%'],
    ['Learning & Development', 'Course completion rate', 'PERCENTAGE', '90', '%'], ['Finance & Operations', 'Invoices closed on time', 'PERCENTAGE', '98', '%'],
    ['Backend Engineering', 'API uptime', 'PERCENTAGE', '99.9', '%'],
  ];
  for (const [deptName, name, metric, value, unit] of goals) {
    await pool.query(
      `INSERT INTO DepartmentGoal (DepartmentID, GoalName, GoalMetric, MetricValue, Unit, Frequency, IsDynamic, Description, IsActive, approvedByEL)
       SELECT ?, ?, ?, ?, ?, 'Monthly', 0, ?, 1, 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DepartmentGoal WHERE GoalName = ?)`,
      [d(deptName), name, metric, value, unit, `${name} — monthly goal`, name],
    );
  }
  await pool.query("UPDATE DepartmentGoal SET Frequency = 'Monthly', MetricValue = COALESCE(MetricValue, '90'), Unit = COALESCE(Unit, '%') WHERE Frequency = '' OR Frequency IS NULL");
  console.log('  ✓ Tasks, targets and goals');

  // ── Daily work, goal data and the efficiency summary behind the dashboards ─
  const days = workingDays(15);
  const workers = placement.map(([email, deptName]) => ({ userId: u(email), deptId: d(deptName) }));
  const [taskRows] = await pool.query<mysql.RowDataPacket[]>('SELECT TaskID, DepartmentID, StandardTimeMins FROM DepartmentTask WHERE IsActive = 1');
  const [goalRows] = await pool.query<mysql.RowDataPacket[]>('SELECT GoalID, DepartmentID FROM DepartmentGoal WHERE IsActive = 1');
  const remarks = ['Completed as planned', 'Paired with a teammate', 'Blocked on review for a while', 'Shipped to staging', 'Followed up with stakeholders'];

  for (const w of workers) {
    const own = taskRows.filter((t) => t['DepartmentID'] === w.deptId);
    for (const [i, day] of days.entries()) {
      // Quiet personality per user: some steady performers, some with dips
      const skill = 0.75 + (w.userId % 5) * 0.06;
      const leave = rand() < 0.04;
      const allocated = 8;
      const worked = leave ? 0 : Math.min(9.5, Math.round((allocated * (skill + (rand() - 0.5) * 0.25)) * 4) / 4);
      const target = leave ? 0 : Math.min(130, Math.round(skill * 100 + between(-15, 15)));
      const utilization = leave ? 0 : Math.round((worked / allocated) * 100);
      const level = target >= 100 && utilization >= 80 ? 'High' : target >= 80 && utilization >= 50 ? 'At Par' : 'Low';
      await pool.query(
        `INSERT INTO EfficiencyUtilizationSummary (UserID, DepartmentID, WorkDate, WorkType, UtilizationPercent, EfficiencyLevel,
           TargetAchievedPercent, AllocatedTimeHrs, TotalTimeOfWork, DayType, DataStatus, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, 'DAILY', ?, ?, ?, ?, ?, ?, 'Final', NOW(), NOW())`,
        [w.userId, w.deptId, day, utilization, leave ? 'Low' : level, target, allocated, worked, leave ? 'Leave' : 'Working'],
      );
      if (leave || !own.length || i < days.length - 8) continue; // entries for the last 8 working days
      const t = own[i % own.length]!;
      const std = Number(t['StandardTimeMins']);
      const approved = i < days.length - 3;
      const rejected = !approved && rand() < 0.25;
      await pool.query(
        `INSERT INTO UserWorkData (TaskID, UserID, WorkDate, setUp, AllocatedTime, TimeTakenToWork, IsForTarget, Units, DepartmentID,
           AchivedUnits, Remarks, LeaveType, ApprovedByEL, CommentForRejection, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, 1, ?, ?, 0, NULL, ?, ?, ?, 'NONE', ?, ?, NOW(), NOW())`,
        [t['TaskID'], w.userId, day, std, Math.round(std * (0.8 + rand() * 0.4)), w.deptId, between(1, 4), pick(remarks),
          approved ? 1 : 0, rejected ? 'Please split this into the sub-tasks you worked on.' : null],
      );
    }
    for (const g of goalRows.filter((x) => x['DepartmentID'] === w.deptId)) {
      for (const day of days.slice(-5)) {
        await pool.query(
          `INSERT INTO UserGoalData (WorkDate, UserID, DepartmentID, GoalID, FixedGoal, AchievedGoal, Target, ApprovedByEL, Comment)
           VALUES (?, ?, ?, ?, 100, ?, 0, 1, NULL)`,
          [day, w.userId, w.deptId, g['GoalID'], between(72, 108)],
        );
      }
    }
  }
  await pool.query(
    `INSERT INTO UserLeave (UserID, WorkDate, LeaveType, Reason) VALUES (?, ?, 'FULL_DAY', 'Family function'), (?, ?, 'HALF_DAY', 'Doctor appointment'), (?, ?, 'FULL_DAY', 'Travel')`,
    [u('emp2@tapmind.com'), days[3], u('neha.kapoor@tapmind.com'), days[8], u('aditya.singh@tapmind.com'), days[11]],
  );
  console.log('  ✓ Work entries, goal data, leave and efficiency summary');

  // ── Recruiting: positions, candidate calls; admin tickets ──────────────────
  const positions: [string, string, string, number][] = [
    ['Senior Backend Engineer', 'Node.js, MySQL, distributed systems — 5+ years', 'OPEN', 18], ['QA Automation Engineer', 'Playwright, API testing', 'OPEN', 9],
    ['Account Manager — APAC', 'Publisher relationships across APAC', 'PAUSED', 34], ['Product Designer', 'Design systems and dashboards', 'CLOSED', 41],
    ['L&D Coordinator', 'Plan and run internal training', 'OPEN', 5], ['Finance Associate', 'Billing and reconciliation', 'CLOSED', 27],
  ];
  for (const [name, jd, status, daysOpen] of positions) {
    await pool.query(
      `INSERT INTO JobPositions (PositionName, JD_Details, Status, CreatedByUserID, ClosedByUserID, OpenDate, CloseDate, PausedDate, CreatedAt, UpdatedAt)
       SELECT ?, ?, ?, ?, ?, CURDATE() - INTERVAL ? DAY, ?, ?, NOW(), NOW() FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM JobPositions WHERE PositionName = ?)`,
      [name, jd, status, u('hr@tapmind.com'), status === 'OPEN' ? null : u('hr@tapmind.com'), daysOpen,
        status === 'CLOSED' ? new Date(Date.now() - 2 * 864e5) : null, status === 'PAUSED' ? new Date(Date.now() - 864e5) : null, name],
    );
  }
  const [posRows] = await pool.query<mysql.RowDataPacket[]>('SELECT PositionID FROM JobPositions ORDER BY PositionID LIMIT 3');
  const candidates = ['Ravi Teja', 'Ananya Bose', 'Farhan Ali', 'Lakshmi Menon', 'Siddharth Jain', 'Tanvi Shah'];
  for (const [i, name] of candidates.entries()) {
    await pool.query(
      `INSERT INTO TACallSchedule (TAUserID, CandidateName, PositionID, ScheduledDatetime, ActualCallDatetime, Status, RescheduleCount, CreatedAt, UpdatedAt)
       VALUES (?, ?, ?, NOW() + INTERVAL ? HOUR, NULL, ?, 0, NOW(), NOW())`,
      [u('isha.gupta@tapmind.com'), name, posRows[i % posRows.length]!['PositionID'], (i - 2) * 26, i < 2 ? 'COMPLETED' : 'SCHEDULED'],
    );
  }
  const tickets: [string, string, string][] = [
    ['Laptop request for new joiners', 'Two MacBook Pros for the QA hires starting next week', 'OPEN'],
    ['VPN access for contractors', 'Temporary VPN accounts for the APAC contractors', 'OPEN'],
    ['Renew Jira licences', 'Annual renewal due this month', 'CLOSED'],
    ['Office Wi-Fi drops on floor 3', 'Intermittent drops between 2–4 pm', 'PAUSED'],
    ['Conference room booking tool', 'Evaluate options for room booking', 'OPEN'],
    ['Update leave policy page', 'Reflect the new comp-off rules', 'CLOSED'],
  ];
  for (const [title, desc, status] of tickets) {
    await pool.query(
      `INSERT INTO AdminTasks (Title, Description, Status, CreatedByUserID, OpenDate, CloseDate, PausedDate, CreatedAt, UpdatedAt)
       SELECT ?, ?, ?, ?, CURDATE() - INTERVAL 6 DAY, ?, ?, NOW(), NOW() FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM AdminTasks WHERE Title = ?)`,
      [title, desc, status, admin, status === 'CLOSED' ? new Date() : null, status === 'PAUSED' ? new Date() : null, title],
    );
  }
  console.log('  ✓ Positions, candidate calls and admin tickets');

  // ── Sales: publisher calls and TAM accounts ─────────────────────────────────
  const publishers = ['NewsWave Media', 'GameHub Studios', 'TravelTales', 'FinPulse Daily', 'CricketNow', 'StreamBox', 'RecipeLane', 'TechByte'];
  const callStatus = ['COMPLETED', 'COMPLETED', 'SCHEDULED', 'SCHEDULED', 'NO_SHOW', 'RESCHEDULED', 'COMPLETED', 'SCHEDULED'];
  for (const [i, pub] of publishers.entries()) {
    await pool.query(
      `INSERT INTO SalesCallSchedule (CreaterUserID, PublisherName, SalesUserID, ScheduledDatetime, ActualCallDatetime, status, reschedule_count, created_at, updated_at)
       VALUES (?, ?, ?, NOW() + INTERVAL ? HOUR, ?, ?, ?, NOW(), NOW())`,
      [u('sales1@tapmind.com'), pub, i % 2 ? u('sales1@tapmind.com') : u('karan.malhotra@tapmind.com'), (i - 4) * 20,
        callStatus[i] === 'COMPLETED' ? new Date() : null, callStatus[i], callStatus[i] === 'RESCHEDULED' ? 1 : 0],
    );
  }
  for (const [i, pub] of publishers.slice(0, 6).entries()) {
    await pool.query(
      `INSERT INTO tam_accounts (publisher_name, status, entry_date, live_date, created_by_user_id, created_at, updated_at)
       VALUES (?, ?, CURDATE() - INTERVAL ? DAY, ?, ?, NOW(), NOW())`,
      [pub, i < 3 ? 'LIVE' : 'NOT_LIVE', 20 - i * 3, i < 3 ? new Date(Date.now() - (10 - i) * 864e5) : null, u('pooja.nair@tapmind.com')],
    );
  }
  console.log('  ✓ Sales calls and TAM accounts');

  // ── Support: queries, onboarding and engagement surveys ────────────────────
  const queries: [string, string, string, string, string, string, number][] = [
    ['Q-1001', 'rohan.das@tapmind.com', 'HR', 'PAYROLL', 'Payslip for September not visible', 'The portal shows August as the latest payslip.', 6],
    ['Q-1002', 'neha.kapoor@tapmind.com', 'HR', 'LEAVE', 'Comp-off not credited', 'Worked on the Saturday release; comp-off is still missing.', 30],
    ['Q-1003', 'aditya.singh@tapmind.com', 'L_D', 'TRAINING', 'Access to Playwright course', 'Need a licence for the advanced Playwright course.', 80],
    ['Q-1004', 'pooja.nair@tapmind.com', 'HR', 'BENEFITS', 'Add spouse to health insurance', 'Married last month; how do I add my spouse?', 12],
    ['Q-1005', 'isha.gupta@tapmind.com', 'L_D', 'CERTIFICATION', 'AWS certification reimbursement', 'Passed the SAA exam — how do I claim the fee?', 96],
    ['Q-1006', 'emp1@tapmind.com', 'HR', 'POLICY', 'Work-from-home days in November', 'Is the 2-day WFH policy continuing in November?', 5],
    ['Q-1007', 'karan.malhotra@tapmind.com', 'HR', 'ATTENDANCE', 'Missed punch on Tuesday', 'Badge reader was down; please regularise.', 50],
    ['Q-1008', 'emp3@tapmind.com', 'L_D', 'NOMINATION', 'Nomination for leadership programme', 'Would like to be considered for the Q4 cohort.', 20],
  ];
  const qStatus = ['CLOSED', 'IN_PROGRESS', 'OPEN', 'RESOLVED', 'OPEN', 'OPEN', 'IN_PROGRESS', 'CLOSED'];
  const [nameRows] = await pool.query<mysql.RowDataPacket[]>('SELECT UserID, UserName FROM Users');
  const nameOf = new Map(nameRows.map((r) => [r['UserID'] as number, r['UserName'] as string]));
  const deptOf = new Map(placement.map(([email, deptName]) => [u(email), deptName]));
  for (const [i, [qid, email, team, cat, subject, desc, age]] of queries.entries()) {
    const uid = u(email);
    const status = qStatus[i]!;
    const ratings = status === 'CLOSED' ? JSON.stringify(i === 0 ? [9, 8, 9, 9, 8, 9] : [5, 4, 6, 5, 5, 6]) : null;
    await pool.query(
      `INSERT INTO queries (id, employee_id, employee_name, department, team, category, subject, description, priority, raised_on, age_hours, status, ratings, rating_comment, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE() - INTERVAL ? DAY, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE status = VALUES(status)`,
      [qid, uid, nameOf.get(uid), deptOf.get(uid) ?? '', team, cat, subject, desc, i % 3 === 0 ? 'HIGH' : 'NORMAL', Math.ceil(age / 24), age, status,
        ratings, status === 'CLOSED' ? (i === 0 ? 'Quick and clear, thanks!' : 'Took a while to get a response.') : null],
    );
    await pool.query('DELETE FROM query_messages WHERE query_id = ?', [qid]);
    await pool.query('INSERT INTO query_messages (query_id, author, text, created_at) VALUES (?, ?, ?, NOW() - INTERVAL ? HOUR)', [qid, nameOf.get(uid), desc, age]);
    if (status !== 'OPEN') {
      await pool.query('INSERT INTO query_messages (query_id, author, text, created_at) VALUES (?, ?, ?, NOW() - INTERVAL ? HOUR)',
        [qid, team === 'HR' ? 'Meera Krishnan' : 'Isha Gupta', 'Thanks for raising this — we are looking into it and will update you shortly.', Math.max(age - 4, 1)]);
    }
  }
  const joiners: [string, string, number, string, number[]][] = [
    ['rohan.das@tapmind.com', 'S-101', 40, 'submitted', [9, 8, 9, 8, 9, 9, 8]],
    ['aditya.singh@tapmind.com', 'S-102', 28, 'submitted', [6, 5, 7, 6, 7, 6, 6]],
    ['pooja.nair@tapmind.com', 'S-103', 20, 'pending', []],
    ['isha.gupta@tapmind.com', 'S-104', 14, 'pending', []],
    ['karan.malhotra@tapmind.com', 'S-105', 45, 'no_response', []],
  ];
  for (const [email, sid, ago, status, answers] of joiners) {
    const uid = u(email);
    await pool.query(
      `INSERT INTO onboarding_surveys (id, employee_id, employee_name, department, joined_date, sent_on, due_date, status, answers, feedback, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURDATE() - INTERVAL ? DAY, CURDATE() - INTERVAL ? DAY, CURDATE() - INTERVAL ? DAY, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE status = VALUES(status)`,
      [sid, uid, nameOf.get(uid), deptOf.get(uid) ?? '', ago, ago - 7, ago - 14, status.toUpperCase(), answers.length ? JSON.stringify(answers) : null,
        status === 'submitted' ? (answers[0]! > 7 ? 'Buddy programme helped a lot.' : 'Accounts took a week to set up.') : null],
    );
  }
  await pool.query(
    `INSERT INTO engagement_surveys (id, quarter, months, sent_to, opens, closes, status, created_at) VALUES
       ('E-02', 'Q1 FY27 — Apr to Jun 2026', '["April","May","June"]', 15, CURDATE() - INTERVAL 120 DAY, CURDATE() - INTERVAL 106 DAY, 'CLOSED', NOW()),
       ('E-03', 'Q2 FY27 — Jul to Sep 2026', '["July","August","September"]', 16, CURDATE() - INTERVAL 10 DAY, CURDATE() + INTERVAL 4 DAY, 'COLLECTING', NOW())
     ON DUPLICATE KEY UPDATE status = VALUES(status)`);
  await pool.query("DELETE FROM engagement_responses WHERE survey_id IN ('E-02', 'E-03')");
  const responders = ['emp1@tapmind.com', 'emp2@tapmind.com', 'rohan.das@tapmind.com', 'neha.kapoor@tapmind.com', 'aditya.singh@tapmind.com', 'pooja.nair@tapmind.com'];
  for (const [i, email] of responders.entries()) {
    const uid = u(email);
    const base = 6 + (i % 4);
    await pool.query(
      `INSERT INTO engagement_responses (survey_id, respondent_id, respondent_name, anonymous, months, rest, feedback, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [i < 4 ? 'E-03' : 'E-02', uid, nameOf.get(uid), i % 2, JSON.stringify([base, Math.min(10, base + 1), base]), JSON.stringify([base, Math.min(10, base + 1)]),
        pick(['Annual Day was excellent.', 'More cross-team activities please.', '', 'Town hall Q&A was cut short.'])],
    );
  }
  console.log('  ✓ Support queries, onboarding and engagement surveys');

  // ── PMS: quarterly reviews, monthly reviews, goals ─────────────────────────
  const reviewees = workers.slice(0, 8);
  for (const [i, w] of reviewees.entries()) {
    const target = between(78, 112), goal = between(70, 105), util = between(72, 98);
    const eff = Math.round((target + goal + util) / 3);
    await pool.query(
      `INSERT INTO quarterlyreview (emp_id, quarter, quarter_year, quarter_start_date, quarter_end_date, target_percent, goal_achievement,
         utilization_percent, efficiency_percent, efficiency_label, system_grade, manager_avg_rating, final_rating, status, created_at, updated_at)
       VALUES (?, 'Q2', 2026, '2026-07-01', '2026-09-30', ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [w.userId, target, goal, util, eff, eff >= 95 ? 'High' : eff >= 80 ? 'At Par' : 'Low', Math.min(5, Math.max(1, Math.round(eff / 20))),
        (3 + rand() * 2).toFixed(2), (3 + rand() * 2).toFixed(2), i % 4 === 3 ? 'At Risk' : 'On Track'],
    );
    await pool.query(
      `INSERT INTO monthlyreview (emp_id, month, year, target, goal, utilization, efficiency, efficiency_label, status, start_date, end_date, created_at, updated_at)
       VALUES (?, 'September', 2026, ?, ?, ?, ?, ?, 'Submitted', '2026-09-01', '2026-09-30', NOW(), NOW())`,
      [w.userId, target, goal, util, eff, eff >= 95 ? 'High' : eff >= 80 ? 'At Par' : 'Low'],
    );
    await pool.query(
      `INSERT INTO pmsgoals (UserID, DepartmentID, Quarter, GoalYear, GoalTitle, Description, Weight, Category, Status)
       VALUES (?, ?, 'Q3', 2026, ?, ?, ?, ?, ?), (?, ?, 'Q3', 2026, ?, ?, ?, ?, ?)`,
      [w.userId, w.deptId, 'Deliver quarterly roadmap items', 'Ship the committed items on time', 60, 'Delivery', i % 2 ? 'Acknowledged' : 'Pending',
        w.userId, w.deptId, 'Grow a skill', 'Complete one certification or course', 40, 'Learning', 'Pending'],
    );
  }
  console.log('  ✓ PMS reviews and goals');

  await pool.query('INSERT IGNORE INTO SchemaMigration (Name) VALUES (?)', [MARKER]);
  console.log(`✅ Demo data loaded. Demo users sign in with ${PASSWORD} — e.g. vikram.rao@tapmind.com (Executive Leader).`);
}

main()
  .catch((err) => {
    console.error('Demo data failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
