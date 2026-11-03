/**
 * Calculation logic: the goal and target calculations of the Java backend, in one place.
 *
 * GOAL
 *   calculateGoal({ kind: 'entry', ... })  one goal entry: its efficiency % (Goals Achieved list, goal form)
 *   calculateGoal({ kind: 'day',   ... })  one user's day: the goal % in the efficiency report
 *   calculateGoal({ kind: 'user',  ... })  one user over a date range: the goal % behind every dashboard
 *                                          average (user, department, EL, FL and company are averages of these)
 * TARGET (see the section at the end)
 *   calculateTarget({ kind: 'day' | 'revision' | 'dayAverage' | 'groupAverage' | 'userAverage' | 'units' })
 * DAILY EFFICIENCY (the rows of EfficiencyUtilizationSummary)
 *   calculateEfficiency({ kind: 'day' | 'liveAccount' | 'positionClosed' })   a day's row
 *   calculateEfficiency({ kind: 'levelScore' | 'scoreLevel' | 'periodLevel' | 'reportLevel' })   the level of an average
 * UTILIZATION (see the section at the end)
 *   calculateUtilization({ kind: 'day' | 'average' })   a day's utilization %, and every average of it
 *
 * The department and user rules live here and nowhere else; the services only load data and call in.
 * Java sources: UserGoalDataService.mapToResponse, EfficiencyReportService.attachGoalPercent /
 * attachTargetAchievedPercent / attachRevisedTargetPercent, DashBoardService.getUserGoalEfficiency,
 * EfficiencyServiceImpl.calculateAndSaveDailyEfficiency.
 */
import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';

type Row = mysql.RowDataPacket;

// ── Shared pieces ─────────────────────────────────────────────────────────────────────────────────

export const num = (v: unknown) => (v == null || v === '' ? 0 : Number(v));

/** BigDecimal.setScale(2, HALF_UP) */
export const round2 = (n: number) => Math.round(Number((n * 100).toPrecision(12))) / 100;
/** BigDecimal.divide(b, 4, HALF_UP) */
export const ratio4 = (a: number, b: number) => Math.round(Number(((a / b) * 10000).toPrecision(12))) / 10000;
/** a.divide(b, 4).multiply(100).setScale(2): the percent of a in b */
export const percentOf = (a: number, b: number) => round2(ratio4(a, b) * 100);

const inWindow = (date: string, from: string, to: string) => date >= from && date <= to;
const Q2 = { from: '2026-04-01', to: '2026-06-30' };
const inQ2 = (from: string, to: string) => from >= Q2.from && to <= Q2.to;

// Goal a user is measured against: an EL-approved revision replaces FixedGoal
export const EFFECTIVE_GOAL =
  "CASE WHEN ug.RevisedGoal IS NOT NULL AND ug.RevisedGoal != '' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(ug.RevisedGoal, '$.elApproved')) = 'true' " +
  "THEN CAST(JSON_EXTRACT(ug.RevisedGoal, '$.value') AS DECIMAL(10,2)) " +
  'ELSE ug.FixedGoal END';

// Users whose goal is simply their target % (Java GOAL_EQUALS_TARGET_USERS)
export const GOAL_EQUALS_TARGET_USERS = [135, 122, 131, 112, 102, 121, 108];

// ── 1. One goal entry ─────────────────────────────────────────────────────────────────────────────

export type RevisedGoal = { value?: number | null; elApproved?: boolean } | null;

export interface GoalEntryInput {
  userId: number;
  departmentId: number;
  goalId: number;
  fixed: number | null;
  achieved: number | null;
  revised: RevisedGoal;
}

export interface GoalEntryResult {
  efficiency: number;
  recalculatedTarget: number | null;
  /** the goal and achieved values to show: some departments restate them */
  fixed: number | null;
  achieved: number | null;
}

/** Achieved units of one task for this entry's user, day and department (for the departments scored from work data) */
export type TaskUnits = (task: number) => Promise<number>;

async function goalEntry(e: GoalEntryInput, taskUnits: TaskUnits): Promise<GoalEntryResult> {
  const { departmentId: dept, goalId, userId } = e;
  let { fixed, achieved } = e;
  let efficiency = 0;
  let recalculatedTarget: number | null = null;

  if (dept === 37) {
    // 70% of the units done on task 65 is the target
    const units = await taskUnits(65);
    if (units > 0) {
      recalculatedTarget = round2(units * 0.7);
      efficiency = recalculatedTarget > 0 ? percentOf(achieved ?? 0, recalculatedTarget) : 0;
    } else {
      recalculatedTarget = 0;
    }
  } else if (dept === 13) {
    // goal 27 is 70% of task 31, goal 28 is 50% of task 48
    const task = goalId === 27 ? 31 : goalId === 28 ? 48 : null;
    const share = goalId === 27 ? 0.7 : goalId === 28 ? 0.5 : null;
    if (task && share) {
      recalculatedTarget = round2((await taskUnits(task)) * share);
      fixed = recalculatedTarget;
      efficiency = recalculatedTarget > 0 ? percentOf(achieved ?? 0, recalculatedTarget) : 0;
    } else {
      recalculatedTarget = 0;
      efficiency = fixed != null && fixed > 0 ? percentOf(achieved ?? 0, fixed) : 0;
    }
  } else if (dept === 1) {
    // only the two budget goals are scored
    const budget = fixed ?? 0;
    const spend = achieved ?? 0;
    if (goalId === 64 && budget > 0) {
      const spent = Math.round(Number((ratio4(spend, budget) * 100).toPrecision(12)) * 10000) / 10000;
      efficiency = spent >= 80 ? 100 : Math.floor(ratio4(spent, 0.8));
    } else if (goalId === 66 && budget > 0) {
      efficiency = percentOf(spend, budget);
    }
  } else if (dept === 22 && achieved != null) {
    // days taken: under 40 is 100, then 10 points off for every further 10 days
    const days = Math.trunc(achieved);
    efficiency = days < 40 ? 100 : Math.max(100 - Math.floor((days - 40) / 10) * 10, 0);
  } else if ([14, 31, 32].includes(dept) && fixed != null && achieved != null && fixed > 0) {
    // reaching the goal is 100, going over it costs the excess
    const reached = percentOf(achieved, fixed);
    efficiency = reached <= 100 ? (reached === 0 ? 0 : 100) : 200 - reached;
    fixed = 100;
    achieved = reached;
  } else if (userId === 129 && fixed != null && achieved != null && achieved > 0) {
    // lower is better for this user
    efficiency = achieved <= fixed ? 100 : percentOf(fixed, achieved);
  } else {
    const goal = e.revised && e.revised.elApproved === true && e.revised.value != null ? Number(e.revised.value) : fixed;
    if (goal != null && achieved != null && goal > 0) efficiency = percentOf(achieved, goal);
  }
  return { efficiency, recalculatedTarget, fixed, achieved };
}

// ── 2. One user's day ─────────────────────────────────────────────────────────────────────────────

export interface DayGoalRow { GoalID: number; DepartmentID: number; AchievedGoal: unknown; FixedGoal: unknown; EffGoal: unknown }

export interface GoalDayInput {
  userId: number;
  departmentId: number;
  date: string;
  targetAchievedPercent: unknown;
  /** the user's goal entries for that day */
  goalRows: DayGoalRow[];
  /** units done that day in the department: all target units, and task 65's */
  units?: { all: number; t65: number };
  /** 'report' (default): the efficiency report's department rules. 'dashboard': the dashboard user summary's, which only knows departments 7 and 19 and averages the day's goals for everyone else */
  rules?: 'report' | 'dashboard';
}

function goalDay(d: GoalDayInput): number {
  const { userId: uid, departmentId: dept, date, goalRows } = d;
  const sum = (rows: DayGoalRow[], key: 'AchievedGoal' | 'FixedGoal') => rows.reduce((n, g) => n + num(g[key]), 0);
  const generic = () => {
    if (!goalRows.length) return 0;
    const pcts = goalRows.map((g) => (num(g.EffGoal) > 0 ? (num(g.AchievedGoal) * 100) / num(g.EffGoal) : 0));
    return round2(pcts.reduce((n, p) => n + p, 0) / pcts.length);
  };

  if (dept === 19) {
    const g67 = goalRows.filter((g) => g.GoalID === 67);
    const g68 = goalRows.filter((g) => g.GoalID === 68);
    const fixed67 = sum(g67, 'FixedGoal');
    const fixed68 = sum(g68, 'FixedGoal');
    if (fixed67 + fixed68 === 0) return generic();
    const p67 = fixed67 > 0 ? ratio4(sum(g67, 'AchievedGoal'), fixed67) * 100 : 0;
    const p68 = fixed68 > 0 ? ratio4(sum(g68, 'AchievedGoal'), fixed68) * 100 : 0;
    return Math.round((p67 + p68) * 10000) / 10000;
  }
  if (dept === 7) return 100;
  if (d.rules === 'dashboard') return generic();
  if (dept === 37 || dept === 21) {
    const own = goalRows.filter((g) => g.DepartmentID === dept);
    const base = d.units ? (dept === 37 ? d.units.t65 : d.units.all) : 0;
    const denominator = own.length * base * 0.7; // Java's join repeats the units once per goal row
    return own.length && denominator > 0 ? round2((sum(own, 'AchievedGoal') * 100) / denominator) : 0;
  }
  if (dept === 22) {
    const own = goalRows.filter((g) => g.DepartmentID === 22);
    if (!own.length) return 0;
    const pts = own.map((g) => (num(g.AchievedGoal) < 40 ? 100 : Math.max(100 - Math.floor((num(g.AchievedGoal) - 40) / 10) * 10, 0)));
    return round2(pts.reduce((n, p) => n + p, 0) / pts.length);
  }
  if (uid === 130 || uid === 97 || uid === 118) return round2(num(d.targetAchievedPercent));
  if (uid === 158 && dept === 42 && inWindow(date, Q2.from, Q2.to)) return round2(num(d.targetAchievedPercent));
  return generic();
}

// ── 3. One user over a date range ─────────────────────────────────────────────────────────────────

/** Everything the range calculation needs for one user; build it with loadGoalContexts */
export interface UserGoalContext {
  /** the user's goal entries in the range */
  goalRows: { DepartmentID: number; Month: string; AchievedGoal: unknown; FixedGoal: unknown; EffGoal: unknown }[];
  /** target % of each working day (full-day leave out), for the users whose goal is their target */
  targetDays: { date: string; target: number }[];
  /** department 19's task units per day, to recompute its target inside 22 May – 30 Jun 2026 */
  dept19Tasks: Map<string, Map<number, { ach: number; units: number }>>;
  /** units done for target in the range, for users 153, 154 (task 65, department 37) and 155 (all tasks), 2026 Q2 only */
  targetUnits: { task65: number; all: number };
}

export const EMPTY_USER_GOAL_CONTEXT: UserGoalContext = { goalRows: [], targetDays: [], dept19Tasks: new Map(), targetUnits: { task65: 0, all: 0 } };

export interface GoalUserInput {
  userId: number;
  /** the department the figure is for (0 when none) */
  departmentId: number;
  from: string;
  to: string;
  context: UserGoalContext;
}

const sumOf = (rows: { AchievedGoal: unknown }[], key: 'AchievedGoal' | 'FixedGoal' | 'EffGoal') =>
  rows.reduce((n, g) => n + num((g as Record<string, unknown>)[key]), 0);

/** Department 22 is scored per month: under 40 achieved = 100, then 10 points off per 10 over; months without data count as 0 */
function dept22Goal(rows: UserGoalContext['goalRows'], from: string, to: string): number {
  const monthly = new Map<string, number[]>();
  for (const g of rows) {
    const a = num(g.AchievedGoal);
    const score = a < 40 ? 100 : Math.max(100 - Math.floor((a - 40) / 10) * 10, 0);
    (monthly.get(g.Month) ?? monthly.set(g.Month, []).get(g.Month)!).push(score);
  }
  let [y, m] = from.split('-').map(Number) as [number, number];
  const [endY, endM] = to.split('-').map(Number) as [number, number];
  let total = 0;
  let months = 0;
  while (y < endY || (y === endY && m <= endM)) {
    const scores = monthly.get(`${y}-${String(m).padStart(2, '0')}`);
    if (scores) total += round2(scores.reduce((n, v) => n + v, 0) / scores.length);
    months++;
    if (++m > 12) { m = 1; y++; }
  }
  return months ? round2(total / months) : 0;
}

/** Java computeAvgTargetPercentForDash: mean target of the working days; department 19 is recomputed in its window */
function averageTarget(c: UserGoalContext, dept: number): number {
  if (!c.targetDays.length) return 0;
  let total = 0;
  for (const day of c.targetDays) {
    let value = day.target;
    if (dept === 19 && inWindow(day.date, '2026-05-22', '2026-06-30')) {
      const t = c.dept19Tasks.get(day.date);
      const pct = (id: number) => { const x = t?.get(id); return x && x.units > 0 ? Math.round(ratio4(x.ach, x.units) * 1000000) / 10000 : 0; };
      value = Math.round(((pct(68) + pct(78)) / 2 + Number.EPSILON) * 10000) / 10000;
      if (value === 0) value = Math.round(((pct(196) + pct(197)) / 2 + Number.EPSILON) * 10000) / 10000;
    }
    total += value;
  }
  return round2(total / c.targetDays.length);
}

function goalUser(u: GoalUserInput): number {
  const { userId, departmentId: dept, from, to, context: c } = u;
  const rows = c.goalRows;

  if (userId === 90) return 100;
  // Q2 2026: achieved over 35% (SDA) or all (155) of the units done for target
  if ((userId === 153 || userId === 154) && inQ2(from, to)) {
    const fixed = c.targetUnits.task65 * 0.35;
    return fixed === 0 ? 0 : round2(ratio4(sumOf(rows, 'AchievedGoal'), fixed) * 100);
  }
  if (userId === 117) {
    const fixed = sumOf(rows, 'EffGoal');
    return fixed === 0 ? 0 : round2(ratio4(sumOf(rows, 'AchievedGoal'), fixed) * 100);
  }
  if (GOAL_EQUALS_TARGET_USERS.includes(userId)) return averageTarget(c, dept);
  if (userId === 155 && inQ2(from, to)) {
    const fixed = c.targetUnits.all * 0.35;
    return fixed > 0 ? round2(ratio4(sumOf(rows, 'AchievedGoal'), fixed) * 100) : 0;
  }
  if (dept === 21 || dept === 37) {
    const own = rows.filter((g) => g.DepartmentID === dept);
    const eff = sumOf(own, 'EffGoal');
    return eff > 0 ? round2((sumOf(own, 'AchievedGoal') * 100) / eff) : 0;
  }
  if (dept === 22) return dept22Goal(rows.filter((g) => g.DepartmentID === 22), from, to);

  if (!rows.length) return 0;
  const pct = rows.map((g) => {
    if (g.DepartmentID === 7) return 100;
    const eff = num(g.EffGoal);
    return eff === 0 ? 0 : (num(g.AchievedGoal) / eff) * 100;
  });
  return round2(pct.reduce((n, p) => n + p, 0) / pct.length);
}

/** Load what calculateGoal({ kind: 'user' }) needs for these users (null = everyone) over the range */
export async function loadGoalContexts(userIds: number[] | null, from: string, to: string): Promise<Map<number, UserGoalContext>> {
  const contexts = new Map<number, UserGoalContext>();
  const of = (id: number) => contexts.get(id) ?? contexts.set(id, { goalRows: [], targetDays: [], dept19Tasks: new Map(), targetUnits: { task65: 0, all: 0 } }).get(id)!;
  const only = (col: string) => (userIds ? ` AND ${col} IN (${userIds.map(Number).join(',') || 'NULL'})` : '');
  const targetUsers = GOAL_EQUALS_TARGET_USERS.filter((id) => !userIds || userIds.includes(id));

  const [goals] = await pool.query<Row[]>(
    `SELECT ug.UserID, ug.DepartmentID, DATE_FORMAT(ug.WorkDate, '%Y-%m') AS Month, ug.AchievedGoal, ug.FixedGoal, ${EFFECTIVE_GOAL} AS EffGoal
     FROM UserGoalData ug WHERE ug.WorkDate BETWEEN ? AND ?${only('ug.UserID')}`, [from, to]);
  for (const g of goals) of(g['UserID']).goalRows.push({ DepartmentID: g['DepartmentID'], Month: g['Month'], AchievedGoal: g['AchievedGoal'], FixedGoal: g['FixedGoal'], EffGoal: g['EffGoal'] });

  if (targetUsers.length) {
    const [days] = await pool.query<Row[]>(
      `SELECT e.UserID, DATE_FORMAT(e.WorkDate, '%Y-%m-%d') AS d, e.TargetAchievedPercent
       FROM EfficiencyUtilizationSummary e
       WHERE e.UserID IN (?) AND e.DayType = 'Working' AND e.WorkDate BETWEEN ? AND ?
         AND e.WorkDate NOT IN (SELECT uwd.WorkDate FROM UserWorkData uwd WHERE uwd.UserID = e.UserID AND uwd.LeaveType = 'FULL_DAY')
       ORDER BY e.WorkDate`, [targetUsers, from, to]);
    for (const r of days) of(r['UserID']).targetDays.push({ date: r['d'], target: num(r['TargetAchievedPercent']) });

    if (from <= '2026-06-30' && to >= '2026-05-22') {
      const [tasks] = await pool.query<Row[]>(
        `SELECT UserID, DATE_FORMAT(WorkDate, '%Y-%m-%d') AS d, TaskID, COALESCE(SUM(AchivedUnits), 0) AS ach, COALESCE(SUM(Units), 0) AS units
         FROM UserWorkData WHERE UserID IN (?) AND WorkDate BETWEEN ? AND ? AND DepartmentID = 19 AND TaskID IN (68, 78, 196, 197)
         GROUP BY UserID, WorkDate, TaskID`, [targetUsers, from, to]);
      for (const t of tasks) {
        const byDate = of(t['UserID']).dept19Tasks;
        (byDate.get(t['d']) ?? byDate.set(t['d'], new Map()).get(t['d'])!).set(t['TaskID'], { ach: num(t['ach']), units: num(t['units']) });
      }
    }
  }

  const q2Users = [153, 154, 155].filter((id) => !userIds || userIds.includes(id));
  if (q2Users.length && inQ2(from, to)) {
    const [units] = await pool.query<Row[]>(
      `SELECT UserID, COALESCE(SUM(CASE WHEN DepartmentID = 37 AND TaskID = 65 THEN AchivedUnits END), 0) AS task65, COALESCE(SUM(AchivedUnits), 0) AS allUnits
       FROM UserWorkData WHERE UserID IN (?) AND IsForTarget = 1 AND WorkDate BETWEEN ? AND ? GROUP BY UserID`, [q2Users, from, to]);
    for (const r of units) of(r['UserID']).targetUnits = { task65: num(r['task65']), all: num(r['allUnits']) };
  }
  return contexts;
}

// ── The single entry point ────────────────────────────────────────────────────────────────────────

export type GoalCalculation =
  | ({ kind: 'entry'; taskUnits: TaskUnits } & GoalEntryInput)
  | ({ kind: 'day' } & GoalDayInput)
  | ({ kind: 'user' } & GoalUserInput);

export function calculateGoal(c: { kind: 'entry'; taskUnits: TaskUnits } & GoalEntryInput): Promise<GoalEntryResult>;
export function calculateGoal(c: { kind: 'day' } & GoalDayInput): number;
export function calculateGoal(c: { kind: 'user' } & GoalUserInput): number;
export function calculateGoal(c: GoalCalculation): Promise<GoalEntryResult> | number {
  switch (c.kind) {
    case 'entry': return goalEntry(c, c.taskUnits);
    case 'day': return goalDay(c);
    case 'user': return goalUser(c);
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
//  TARGET
//
//  Not here: the daily Target Achieved % itself. Java's EfficiencyServiceImpl works it out (task units
//  achieved vs set) and saves it in EfficiencyUtilizationSummary; Node reads it from that table.
//  Everything done to it afterwards is here:
//
//   calculateTarget({ kind: 'day' })           department rules that restate a day's target
//   calculateTarget({ kind: 'revision' })      an EL-approved revised target recomputes the day
//   calculateTarget({ kind: 'dayAverage' })    a user's average over days
//   calculateTarget({ kind: 'groupAverage' })  department / EL / company average of averages
//   calculateTarget({ kind: 'units' })         achieved units as a percent of units (Entry Approval)
// ══════════════════════════════════════════════════════════════════════════════════════════════════

type TargetRow = Record<string, any>;

/** What the day rules need besides the row itself; loaded by the efficiency report */
export interface TargetSupport {
  /** "user|date|department" -> task -> achieved and set units */
  taskUnits: Map<string, Map<number, { ach: number; units: number }>>;
  /** user -> accounts with the day they were entered and went live (department 23) */
  tam: Map<number, { entry: string; live: string }[]>;
  /** "user|date" -> the EL-approved revision row */
  revisions: Map<string, TargetRow>;
  /** "user|department|date" -> target units achieved and set */
  targetUnits: Map<string, { ach: number; units: number }>;
  /** "user|date" -> target units achieved across departments */
  achievedByUserDate: Map<string, number>;
}

const weekdaysBetween = (from: string, to: string) => {
  let n = 0;
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d = new Date(d.getTime() + 86400000)) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) n++;
  }
  return n;
};

const parseRevision = (v: unknown) => { try { return v ? JSON.parse(String(v)) : null; } catch { return null; } };

/** Java attachTargetAchievedPercent: department 19 (22 May – 30 Jun 2026) and department 23 recompute the day's target; department 22 and user 158 (Apr–Jun 2026) tie goal and target together */
function targetDay(row: TargetRow, s: TargetSupport) {
  const { UserID: uid, DepartmentID: dept, WorkDate: date } = row as { UserID: number; DepartmentID: number; WorkDate: string };
  const tasks = s.taskUnits.get(`${uid}|${date}|${dept}`);
  const pct = (task: number) => { const t = tasks?.get(task); return t && t.units > 0 ? Math.round(ratio4(t.ach, t.units) * 1000000) / 10000 : 0; };

  if (dept === 19 && inWindow(date, '2026-05-22', '2026-06-30')) {
    let result = Math.round(((pct(68) + pct(78)) / 2 + Number.EPSILON) * 10000) / 10000;
    if (result === 0) result = Math.round(((pct(196) + pct(197)) / 2 + Number.EPSILON) * 10000) / 10000;
    row['TargetAchievedPercent'] = result;
  }

  if (dept === 23) {
    const t92 = tasks?.get(92);
    const t93 = tasks?.get(93);
    const units92 = t92?.units ?? 0;
    const units93 = t93?.units ?? 0;
    let p92 = 0;
    let p93 = 0;
    if (units92 > 0) { const r = Math.round(ratio4(t92!.ach, units92) * 100); p92 = Math.max(r >= 90 ? 100 : 100 - (90 - r), 0); }
    if (units93 > 0) { const r = Math.round(ratio4(t93!.ach, units93) * 100); p93 = Math.max(100 - r, 0); }
    const accounts = s.tam.get(uid) ?? [];
    let tamPercent = accounts.reduce((n, a) => { const days = weekdaysBetween(a.entry, a.live); return n + Math.max(days <= 7 ? 100 : 100 - (days - 7) * 5, 0); }, 0);
    if (accounts.length) tamPercent = round2(tamPercent / accounts.length);
    row['TargetAchievedPercent'] = round2((p92 + p93 + tamPercent) / (units92 === 0 && units93 === 0 ? 1 : 3));
  }

  if (dept === 22 && row['GoalPercent'] != null && inWindow(date, Q2.from, Q2.to)) row['TargetAchievedPercent'] = row['GoalPercent'];
  if (uid === 158 && dept === 42 && row['TargetAchievedPercent'] != null && inWindow(date, Q2.from, Q2.to)) row['GoalPercent'] = row['TargetAchievedPercent'];
}

/** Java attachRevisedTargetPercent: an EL-approved revised target recomputes that day's percent */
function targetRevision(row: TargetRow, s: TargetSupport) {
  const rev = s.revisions.get(`${row['UserID']}|${row['WorkDate']}`);
  if (!rev || rev['revisedValue'] == null) return;
  const revised = num(rev['revisedValue']);
  row['revisedTarget'] = parseRevision(rev['RevisedTarget']);
  row['revisedTargetValue'] = revised;
  if (revised <= 0) return;
  const own = s.targetUnits.get(`${row['UserID']}|${row['DepartmentID']}|${row['WorkDate']}`);
  const achieved = own ? own.ach : s.achievedByUserDate.get(`${row['UserID']}|${row['WorkDate']}`);
  if (achieved == null || achieved <= 0) return;
  if (row['TargetAchievedPercent'] != null) row['originalTargetAchievedPercent'] = num(row['TargetAchievedPercent']);
  row['targetUnits'] = own?.units ?? null;
  row['achievedUnits'] = achieved;
  row['TargetAchievedPercent'] = round2((achieved * 100) / revised);
}

/** A user's average target over days: only days with a target count (every day in department 54) */
function targetDayAverage(rows: { TargetAchievedPercent: unknown; DepartmentID: unknown }[]): number {
  let total = 0;
  let counted = 0;
  for (const r of rows) {
    const t = num(r.TargetAchievedPercent);
    total += t;
    if (r.DepartmentID === 54 || t > 0) counted++;
  }
  return counted ? round2(total / counted) : 0;
}

/** A user across the departments they worked in: every department counts, a zero too (Java calculateAverageFromUsers) */
function targetUserAverage(values: unknown[]): number {
  return values.length ? round2(values.reduce<number>((n, v) => n + num(v), 0) / values.length) : 0;
}

/** A department, EL or company average of averages: items without a target are skipped */
function targetGroupAverage(values: unknown[]): number {
  let total = 0;
  let counted = 0;
  for (const v of values) {
    const t = num(v);
    total += t;
    if (t > 0) counted++;
  }
  return counted ? round2(total / counted) : 0;
}

export type TargetCalculation =
  | { kind: 'day'; row: TargetRow; support: TargetSupport }
  | { kind: 'revision'; row: TargetRow; support: TargetSupport }
  | { kind: 'dayAverage'; rows: { TargetAchievedPercent: unknown; DepartmentID: unknown }[] }
  | { kind: 'groupAverage'; values: unknown[] }
  | { kind: 'userAverage'; values: unknown[] }
  | { kind: 'units'; achieved: number; units: number };

/** 'day' and 'revision' change the row in place, as Java does */
export function calculateTarget(c: { kind: 'day' | 'revision'; row: TargetRow; support: TargetSupport }): void;
export function calculateTarget(c: { kind: 'dayAverage'; rows: { TargetAchievedPercent: unknown; DepartmentID: unknown }[] }): number;
export function calculateTarget(c: { kind: 'groupAverage'; values: unknown[] }): number;
export function calculateTarget(c: { kind: 'userAverage'; values: unknown[] }): number;
export function calculateTarget(c: { kind: 'units'; achieved: number; units: number }): number | null;
export function calculateTarget(c: TargetCalculation): number | null | void {
  switch (c.kind) {
    case 'day': return targetDay(c.row, c.support);
    case 'revision': return targetRevision(c.row, c.support);
    case 'dayAverage': return targetDayAverage(c.rows);
    case 'groupAverage': return targetGroupAverage(c.values);
    case 'userAverage': return targetUserAverage(c.values);
    case 'units': return c.units > 0 ? Math.round((c.achieved / c.units) * 10000) / 100 : null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
//  DAILY EFFICIENCY
//
//  What Java's EfficiencyServiceImpl.calculateAndSaveDailyEfficiency works out for each row it saves in
//  EfficiencyUtilizationSummary: the day's target %, utilization % and efficiency level.
//
//   calculateEfficiency({ kind: 'day' })             one user, department and day of work entries
//   calculateEfficiency({ kind: 'liveAccount' })     a TAM account that went live (department 23)
//   calculateEfficiency({ kind: 'positionClosed' })  a closed hiring position's goal (department 22)
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type EfficiencyLevel = 'High' | 'At Par' | 'Low';

export interface EfficiencyResult {
  targetAchievedPercent: number;
  utilizationPercent: number;
  allocatedHrs: number;
  timeTakenHrs: number;
  efficiencyLevel: EfficiencyLevel;
}

export interface DailyEfficiencyInput {
  departmentId: number;
  /** YYYY-MM-DD */
  date: string;
  /** hours of non-target work planned and taken that day */
  allocatedHrs: number;
  timeTakenHrs: number;
  /** average of the day's target entries' achieved ÷ units, in percent; null when there are none */
  averageUnitPercent: number | null;
  halfDayLeave: boolean;
  goal: DailyGoalData;
}

/** The goal data of that user and day that Java's goal % rule reads (loaded once for all days) */
export interface DailyGoalData {
  /** ROUND(AVG(achieved × 100 ÷ fixed), 2) over all the day's goal entries; 0 when none */
  average: number;
  /** department 19's goals 67 and 68 */
  dept19: { achieved67: number; achieved68: number; fixed67: number; fixed68: number };
  /** sum of every goal entry that day, for departments 72, 31, 32 and 14 */
  totals: { fixed: number; achieved: number };
}

const SPECIAL_HOURS_DEPARTMENTS = [3, 4, 14, 23, 31, 32, 48];
const TAT_DEPARTMENTS = [7, 14, 23, 31, 32, 16, 26, 20, 38, 18, 25, 19, 42, 43, 44, 45, 46];

/** The goal % Java uses for a day's efficiency level: only departments 7, 19, 72, 31, 32 and 14 have one, the rest count as 0 */
function dailyGoalPercent(dept: number, g: DailyGoalData): number {
  if (dept === 7) return 100;
  if (dept === 19) {
    const { achieved67, achieved68, fixed67, fixed68 } = g.dept19;
    if (fixed67 + fixed68 === 0) return g.average;
    const p67 = fixed67 > 0 ? ratio4(achieved67, fixed67) * 100 : 0;
    const p68 = fixed68 > 0 ? ratio4(achieved68, fixed68) * 100 : 0;
    return p67 + p68;
  }
  if (dept === 72 || dept === 31 || dept === 32 || dept === 14) {
    if (g.totals.fixed <= 0) return 0;
    const reached = percentOf(g.totals.achieved, g.totals.fixed);
    return reached <= 100 ? (reached === 0 ? 0 : 100) : 200 - reached;
  }
  return 0;
}

const tamPercent = (workingDays: number) => (workingDays <= 7 ? 100 : Math.max(100 - (workingDays - 7) * 5, 0));
const levelByTarget = (percent: number): EfficiencyLevel => (percent >= 90 ? 'High' : percent >= 75 ? 'At Par' : 'Low');

function efficiencyDay(i: DailyEfficiencyInput): EfficiencyResult {
  const dept = i.departmentId;

  // target: the hiring-style departments are scored on time taken vs planned in April to June, the rest on units
  const month = Number(i.date.slice(5, 7));
  let target: number;
  if (TAT_DEPARTMENTS.includes(dept) && month >= 4 && month <= 6 && i.allocatedHrs > 0) {
    const used = ratio4(i.timeTakenHrs, i.allocatedHrs) * 100;
    target = Math.max(used <= 100 ? 100 : 100 - (used - 100), 0);
    target = round2(target);
  } else {
    target = i.averageUnitPercent != null ? round2(i.averageUnitPercent) : 0;
  }

  const goal = dailyGoalPercent(dept, i.goal);
  const level: EfficiencyLevel =
    target >= 100 && goal >= 80 && i.timeTakenHrs <= i.allocatedHrs ? 'High'
      : target >= 80 && goal >= 50 && i.timeTakenHrs <= i.allocatedHrs ? 'At Par' : 'Low';

  return { targetAchievedPercent: target, utilizationPercent: calculateUtilization({ kind: 'day', departmentId: dept, halfDayLeave: i.halfDayLeave, timeTakenHrs: i.timeTakenHrs, level }), allocatedHrs: i.allocatedHrs, timeTakenHrs: i.timeTakenHrs, efficiencyLevel: level };
}

export type EfficiencyCalculation =
  | ({ kind: 'day' } & DailyEfficiencyInput)
  | { kind: 'liveAccount'; entryDate: string; liveDate: string }
  | { kind: 'positionClosed'; achievedGoal: number };

/** The level of an average rather than of a day: High 3 / At Par 2 / Low 1 scores averaged, or a period's average target and utilization */
export type EfficiencyLevelCalculation =
  | { kind: 'levelScore'; level: unknown }
  | { kind: 'scoreLevel'; score: number }
  | { kind: 'periodLevel'; target: number; utilization: number }
  | { kind: 'reportLevel'; target: number; worked: number; allocated: number };

export function calculateEfficiency(c: EfficiencyCalculation): EfficiencyResult;
export function calculateEfficiency(c: { kind: 'levelScore'; level: unknown }): number;
export function calculateEfficiency(c: { kind: 'scoreLevel'; score: number }): EfficiencyLevel;
export function calculateEfficiency(c: { kind: 'periodLevel'; target: number; utilization: number }): EfficiencyLevel;
export function calculateEfficiency(c: { kind: 'reportLevel'; target: number; worked: number; allocated: number }): EfficiencyLevel;
export function calculateEfficiency(c: EfficiencyCalculation | EfficiencyLevelCalculation): EfficiencyResult | EfficiencyLevel | number {
  switch (c.kind) {
    // a level as a score: the dashboards average these (a missing level counts 0)
    case 'levelScore': {
      switch (String(c.level ?? '').trim().toLowerCase()) {
        case 'high': return 3;
        case 'at par': return 2;
        case 'low': return 1;
        default: return 0;
      }
    }
    // the average score back to a level
    case 'scoreLevel': return c.score >= 2.5 ? 'High' : c.score >= 1.5 ? 'At Par' : 'Low';
    // a month's or revised figure: average target % and average utilization %
    case 'periodLevel': return c.target >= 100 && c.utilization >= 80 ? 'High' : c.target >= 80 && c.utilization >= 50 ? 'At Par' : 'Low';
    // one person's summary over a range: average target % and whether the work fitted in the allocated hours
    case 'reportLevel': return c.target >= 100 && c.worked <= c.allocated ? 'High' : c.target >= 80 && c.worked <= c.allocated ? 'At Par' : 'Low';
    case 'day': return efficiencyDay(c);
    case 'liveAccount': {
      // working days from entry to live; up to 7 is 100, then 5 points off per day
      const target = tamPercent(weekdaysBetween(c.entryDate, c.liveDate));
      return { targetAchievedPercent: target, utilizationPercent: target, allocatedHrs: 0, timeTakenHrs: 0, efficiencyLevel: levelByTarget(target) };
    }
    case 'positionClosed': {
      // days taken to close: under 40 is 100, then 10 points off for every further 10 days
      const days = Math.trunc(c.achievedGoal);
      const target = days < 40 ? 100 : Math.max(100 - Math.floor((days - 40) / 10) * 10, 0);
      return { targetAchievedPercent: target, utilizationPercent: target, allocatedHrs: 0, timeTakenHrs: 0, efficiencyLevel: levelByTarget(target) };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
//  UTILIZATION
//  Every utilization % in the app comes from here: the day's own figure, and the averages of it
//  that the dashboards, summaries and reports show.
//
//   calculateUtilization({ kind: 'day' })      one user, department and day: time taken against the day's standard hours
//   calculateUtilization({ kind: 'average' })  the mean of day / user / department / EL figures
// ═══════════════════════════════════════════════════════════════════════════════════════════

export type UtilizationCalculation =
  | { kind: 'day'; departmentId: number; halfDayLeave: boolean; timeTakenHrs: number; level: EfficiencyLevel }
  | { kind: 'average'; values: unknown[]; skipMissing?: boolean };

/** Time taken ÷ the day's standard hours × 100; a Low-efficiency day is held at 100 */
function utilizationDay(c: Extract<UtilizationCalculation, { kind: 'day' }>): number {
  const special = SPECIAL_HOURS_DEPARTMENTS.includes(c.departmentId);
  const standard = c.departmentId === 48 ? (c.halfDayLeave ? 20 : 40) : c.halfDayLeave ? (special ? 3.5 : 4) : special ? 7 : 8;
  let utilization = standard > 0 ? round2(c.timeTakenHrs / standard) * 100 : 0;
  if (c.level === 'Low' && utilization > 100) utilization = 100;
  return Math.round(utilization * 100) / 100;
}

/** Mean to 2 places; nothing to average is 0. A missing value counts as 0, or is left out with skipMissing (Java calculateAverageFromELs) */
function utilizationAverage(c: Extract<UtilizationCalculation, { kind: 'average' }>): number {
  const values = c.skipMissing ? c.values.filter((v) => v != null) : c.values;
  return values.length ? round2(values.reduce<number>((n, v) => n + num(v), 0) / values.length) : 0;
}

export function calculateUtilization(c: UtilizationCalculation): number {
  return c.kind === 'day' ? utilizationDay(c) : utilizationAverage(c);
}
