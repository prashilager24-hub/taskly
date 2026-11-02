/**
 * POST /list-efficiency-summary — Reports → Performance Insights, User History, Query Report, the
 * quarterly / monthly reviews. Port of Java EfficiencyReportService.listEfficiencySummary and
 * listEfficiencySummaryEl.
 *
 * Day rows are enriched exactly as Java does it (leave type, goal %, department 19 / 23 target maths,
 * EL-approved revised targets), full-day leave is dropped, and the summary is the Java hierarchy:
 *   user -> department -> Executive Leader -> company   (filtered by user / department / EL when one is given)
 * with the target / goal summary then replaced by the mean of the monthly values, as Java does whenever
 * a date range is sent. Java runs several queries per row; here the support data is loaded once.
 *
 * Known differences from Java, both Java quirks:
 *  - week / month grouping keeps plain averages; Java answers 500 because those rows have no WorkDate.
 *  - rows of the same date come back in Java's arbitrary MySQL tie order. Where that order decides something (a user
 *    with rows in two departments on their first day of the range is assigned to the department listed first) the
 *    result can differ from production; here ties follow the primary key.
 */
import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { toLocalDateTime, toNum } from '../../utils/javaCompat';
import { EFFECTIVE_GOAL, isFullDay, levelScore, num, scoreToLevel } from './dashboardRollup';
import { calculateGoal, calculateTarget, loadGoalContexts, EMPTY_USER_GOAL_CONTEXT, type DayGoalRow } from '../calculations/calculationLogic';

// BigDecimal.setScale(2, HALF_UP): exact halves round up, so drop float noise before rounding
const round2 = (n: number) => Math.round(Number((n * 100).toPrecision(12))) / 100;

export interface EfficiencySummaryRequest {
  startDate?: string | null;
  endDate?: string | null;
  userID?: number | null;
  departmentID?: number | null;
  eLID?: number | null;
  groupBy?: string | null;
  efficiencyLevel?: string | null;
  isQuarterly?: boolean | null;
  history?: boolean | null;
  isHeExecutiveLeader?: boolean | null;
  filters?: { field: string; operator: string; value: string }[] | null;
}

type Row = Record<string, any>;
type DbRow = mysql.RowDataPacket;

// Java pasted the operator from the request into SQL; only these are accepted here
const OPERATORS = new Set(['=', '>', '<', '>=', '<=', '!=']);
const FILTER_COLUMNS: Record<string, string> = { Name: 'u.UserName', Department: 'd.DepartmentName' };

const ratio4 = (a: number, b: number) => Math.round(Number(((a / b) * 10000).toPrecision(12))) / 10000; // BigDecimal.divide(b, 4, HALF_UP)

// ── Averaging ─────────────────────────────────────────────────────────────────

/** USER level: average of raw daily rows. Target counts only days with a target (always in department 54). */
function computeRowAverages(rows: Row[]) {
  if (!rows.length) return { AvgTargetPercent: 0, AvgUtilizationPercent: 0, AvgAllocatedHrs: 0, AvgTotalWork: 0, EfficiencyLevel: 'Low', _score: 0 };
  let util = 0, allocated = 0, work = 0, score = 0;
  for (const r of rows) {
    util += num(r['UtilizationPercent']);
    allocated += num(r['AllocatedTimeHrs']);
    work += num(r['TotalTimeOfWork']);
    score += levelScore(r['EfficiencyLevel']);
  }
  const n = rows.length;
  const avgScore = Math.round((score / n) * 10000) / 10000;
  return {
    AvgTargetPercent: calculateTarget({ kind: 'dayAverage', rows: rows as { TargetAchievedPercent: unknown; DepartmentID: unknown }[] }),
    AvgUtilizationPercent: round2(util / n),
    AvgAllocatedHrs: round2(allocated / n),
    AvgTotalWork: round2(work / n),
    EfficiencyLevel: scoreToLevel(avgScore),
    _score: avgScore,
  };
}

/** DEPARTMENT / EL / COMPANY level: average of already-averaged items. Target skips zero items. */
function averageOfMaps(items: Row[]) {
  if (!items.length) return { AvgTargetPercent: 0, AvgUtilizationPercent: 0, AvgAllocatedHrs: 0, AvgTotalWork: 0, EfficiencyLevel: 'Low', _score: 0 };
  let util = 0, allocated = 0, work = 0, score = 0;
  for (const i of items) {
    util += num(i['AvgUtilizationPercent']);
    allocated += num(i['AvgAllocatedHrs']);
    work += num(i['AvgTotalWork']);
    score += i['_score'] != null ? num(i['_score']) : levelScore(i['EfficiencyLevel']);
  }
  const n = items.length;
  const avgScore = Math.round((score / n) * 10000) / 10000;
  return {
    AvgTargetPercent: calculateTarget({ kind: 'groupAverage', values: items.map((i) => i['AvgTargetPercent']) }),
    AvgUtilizationPercent: round2(util / n),
    AvgAllocatedHrs: round2(allocated / n),
    AvgTotalWork: round2(work / n),
    EfficiencyLevel: scoreToLevel(avgScore),
    _score: avgScore,
  };
}

// ── Rows ──────────────────────────────────────────────────────────────────────

/** The base rows. day: one per user per day; week / month: averages per user per period. */
async function queryRows(f: EfficiencySummaryRequest, elId: number | null): Promise<DbRow[]> {
  const groupBy = (f.groupBy ?? 'day').toLowerCase();
  const conds: string[] = ['1=1'];
  const params: (string | number)[] = [];
  if (f.startDate && f.endDate) { conds.push('e.WorkDate BETWEEN ? AND ?'); params.push(f.startDate, f.endDate); }
  if (f.userID) { conds.push('e.UserID = ?'); params.push(f.userID); }
  if (f.departmentID) { conds.push('e.DepartmentID = ?'); params.push(f.departmentID); }
  if (elId) { conds.push('e.DepartmentID IN (SELECT d2.DepartmentID FROM Department d2 WHERE d2.ExecutiveLeaderID = ?)'); params.push(elId); }
  if (f.efficiencyLevel) { conds.push('e.EfficiencyLevel = ?'); params.push(f.efficiencyLevel); }
  for (const flt of f.filters ?? []) {
    if (flt.field === 'EL' || flt.field === 'ExecutiveLeader') {
      conds.push('e.DepartmentID IN (SELECT d3.DepartmentID FROM Department d3 WHERE d3.ExecutiveLeaderID = ?)');
      params.push(flt.value);
      continue;
    }
    const column = FILTER_COLUMNS[flt.field];
    if (!column) continue;
    if (flt.operator?.toLowerCase() === 'contains') { conds.push(`${column} LIKE ?`); params.push(`%${flt.value}%`); }
    else if (OPERATORS.has(flt.operator)) { conds.push(`${column} ${flt.operator} ?`); params.push(flt.value); }
  }

  const period = groupBy === 'week' || groupBy === 'month';
  const select = period
    ? `YEAR(e.WorkDate) AS Year, ${groupBy === 'week' ? 'WEEK(e.WorkDate, 1) AS WeekNumber' : 'MONTH(e.WorkDate) AS MonthNumber'},
       ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent, ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
       ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs, ROUND(AVG(e.TotalTimeOfWork),2) AS TotalTimeOfWork,
       MAX(e.EfficiencyLevel) AS EfficiencyLevel`
    : 'e.WorkDate, e.TargetAchievedPercent, e.UtilizationPercent, e.AllocatedTimeHrs, e.TotalTimeOfWork, e.EfficiencyLevel';
  const group = period
    ? `GROUP BY e.UserID, u.UserName, e.DepartmentID, d.DepartmentName, YEAR(e.WorkDate), ${groupBy === 'week' ? 'WEEK(e.WorkDate, 1)' : 'MONTH(e.WorkDate)'}`
    : 'ORDER BY e.WorkDate ASC';

  const [result] = await pool.query<DbRow[]>(
    `SELECT e.UserID, u.UserName, e.DepartmentID, d.DepartmentName, ${select}
     FROM EfficiencyUtilizationSummary e
     JOIN Users u ON e.UserID = u.UserID
     JOIN Department d ON e.DepartmentID = d.DepartmentID
     WHERE ${conds.join(' AND ')} ${group}`,
    params,
  );
  return result;
}

/** week / month grouping: plain averages, as before (Java cannot enrich rows that have no WorkDate) */
function periodResult(result: DbRow[]) {
  const data = result.map((r): Row => ({
    ...r,
    AvgTargetPercent: toNum(r['AvgTargetPercent']), AvgUtilizationPercent: toNum(r['AvgUtilizationPercent']), AvgAllocatedHrs: toNum(r['AvgAllocatedHrs']),
    TargetAchievedPercent: toNum(r['AvgTargetPercent']), UtilizationPercent: toNum(r['AvgUtilizationPercent']), AllocatedTimeHrs: toNum(r['AvgAllocatedHrs']),
    TotalTimeOfWork: toNum(r['TotalTimeOfWork']), GoalPercent: 0, LeaveType: null,
  }));
  const mean = (k: string) => (data.length ? round2(data.reduce((n, r) => n + num(r[k]), 0) / data.length) : 0);
  const summary = { AvgTargetPercent: mean('TargetAchievedPercent'), AvgUtilizationPercent: mean('UtilizationPercent'), AvgAllocatedHrs: mean('AllocatedTimeHrs'), AvgTotalWork: mean('TotalTimeOfWork'), AvgGoalPercent: 0, EfficiencyLevel: data.length ? 'Low' : null };
  return { data, summary };
}

// ── Enrichment (Java attachLeaveType / attachGoalPercent / attachTargetAchievedPercent / attachRevisedTargetPercent) ──

interface Support {
  leave: Map<string, unknown>;
  goals: Map<string, DbRow[]>;           // user|date -> goal rows
  units: Map<string, { all: number; t65: number }>; // user|date|dept -> achieved units (dept 21 / 37 goal maths)
  taskUnits: Map<string, Map<number, { ach: number; units: number }>>; // user|date|dept -> task -> units (dept 19 / 23 target maths)
  tam: Map<number, { entry: string; live: string }[]>;
  revisions: Map<string, DbRow>;         // user|date -> first EL-approved revision
  targetUnits: Map<string, { ach: number; units: number }>; // user|dept|date, rows that count for the target
  achievedByUserDate: Map<string, number>;
}

const ymd = (v: unknown) => toLocalDateTime(v)!.slice(0, 10);
const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => { const l = m.get(k); if (l) l.push(v); else m.set(k, [v]); };

async function loadSupport(base: Row[], f: EfficiencySummaryRequest): Promise<Support> {
  const userIds = [...new Set(base.map((r) => r['UserID'] as number))];
  const dates = base.map((r) => r['WorkDate'] as string).sort();
  const from = dates[0]!, to = dates[dates.length - 1]!;
  const goalFrom = f.startDate && f.endDate ? f.startDate : from;
  const goalTo = f.startDate && f.endDate ? f.endDate : to;
  const hasDept23 = base.some((r) => r['DepartmentID'] === 23);

  const [[leaveRows], [goalRows], [unitRows], [taskRows], [tamRows], [revisionRows], [achievedRows]] = await Promise.all([
    pool.query<DbRow[]>(`SELECT UserID, DATE_FORMAT(WorkDate,'%Y-%m-%d') AS d, LeaveType FROM UserWorkData WHERE UserID IN (?) AND WorkDate BETWEEN ? AND ? ORDER BY DailyTaskLogID`, [userIds, from, to]),
    pool.query<DbRow[]>(
      `SELECT ug.UserID, DATE_FORMAT(ug.WorkDate,'%Y-%m-%d') AS d, ug.DepartmentID, ug.GoalID, ug.AchievedGoal, ug.FixedGoal, ${EFFECTIVE_GOAL} AS EffGoal
       FROM UserGoalData ug WHERE ug.UserID IN (?) AND ug.WorkDate BETWEEN ? AND ?`, [userIds, goalFrom, goalTo]),
    pool.query<DbRow[]>(
      `SELECT UserID, DATE_FORMAT(WorkDate,'%Y-%m-%d') AS d, DepartmentID, SUM(AchivedUnits) AS allUnits, SUM(CASE WHEN TaskID = 65 THEN AchivedUnits ELSE 0 END) AS t65
       FROM UserWorkData WHERE UserID IN (?) AND WorkDate BETWEEN ? AND ? AND DepartmentID IN (21, 37) GROUP BY UserID, WorkDate, DepartmentID`, [userIds, from, to]),
    pool.query<DbRow[]>(
      `SELECT UserID, DATE_FORMAT(WorkDate,'%Y-%m-%d') AS d, DepartmentID, TaskID, SUM(AchivedUnits) AS ach, SUM(Units) AS units
       FROM UserWorkData WHERE UserID IN (?) AND WorkDate BETWEEN ? AND ? AND DepartmentID IN (19, 23) AND TaskID IN (68, 78, 196, 197, 92, 93)
       GROUP BY UserID, WorkDate, DepartmentID, TaskID`, [userIds, from, to]),
    hasDept23
      ? pool.query<DbRow[]>(`SELECT created_by_user_id AS uid, DATE_FORMAT(entry_date,'%Y-%m-%d') AS entry, DATE_FORMAT(live_date,'%Y-%m-%d') AS live FROM tam_accounts WHERE status = 'LIVE' AND created_by_user_id IN (?)`, [userIds])
      : Promise.resolve([[]] as unknown as [DbRow[]]),
    pool.query<DbRow[]>(
      `SELECT UserID, DATE_FORMAT(WorkDate,'%Y-%m-%d') AS d, RevisedTarget, CAST(JSON_EXTRACT(RevisedTarget, '$.value') AS DECIMAL(10,2)) AS revisedValue
       FROM UserWorkData
       WHERE UserID IN (?) AND WorkDate BETWEEN ? AND ? AND RevisedTarget IS NOT NULL AND RevisedTarget != ''
         AND JSON_UNQUOTE(JSON_EXTRACT(RevisedTarget, '$.elApproved')) = 'true' AND JSON_UNQUOTE(JSON_EXTRACT(RevisedTarget, '$.value')) IS NOT NULL
       ORDER BY DailyTaskLogID`, [userIds, from, to]),
    pool.query<DbRow[]>(
      `SELECT UserID, DepartmentID, DATE_FORMAT(WorkDate,'%Y-%m-%d') AS d, COALESCE(SUM(Units),0) AS targetUnits, COALESCE(SUM(AchivedUnits),0) AS achievedUnits
       FROM UserWorkData WHERE UserID IN (?) AND WorkDate BETWEEN ? AND ? AND IsForTarget = 1 GROUP BY UserID, DepartmentID, WorkDate`, [userIds, from, to]),
  ]);

  const leave = new Map<string, unknown>();
  for (const r of leaveRows) { const k = `${r['UserID']}|${r['d']}`; if (!leave.has(k)) leave.set(k, r['LeaveType']); }

  const goals = new Map<string, DbRow[]>();
  for (const g of goalRows) push(goals, `${g['UserID']}|${g['d']}`, g);

  const units = new Map<string, { all: number; t65: number }>();
  for (const u of unitRows) units.set(`${u['UserID']}|${u['d']}|${u['DepartmentID']}`, { all: num(u['allUnits']), t65: num(u['t65']) });

  const taskUnits = new Map<string, Map<number, { ach: number; units: number }>>();
  for (const t of taskRows) {
    const k = `${t['UserID']}|${t['d']}|${t['DepartmentID']}`;
    const m = taskUnits.get(k) ?? taskUnits.set(k, new Map()).get(k)!;
    m.set(t['TaskID'], { ach: num(t['ach']), units: num(t['units']) });
  }

  const tam = new Map<number, { entry: string; live: string }[]>();
  for (const t of tamRows) if (t['entry'] && t['live']) push(tam, t['uid'], { entry: t['entry'], live: t['live'] });

  const revisions = new Map<string, DbRow>();
  for (const r of revisionRows) { const k = `${r['UserID']}|${r['d']}`; if (!revisions.has(k)) revisions.set(k, r); }

  const targetUnits = new Map<string, { ach: number; units: number }>();
  const achievedByUserDate = new Map<string, number>();
  for (const a of achievedRows) {
    targetUnits.set(`${a['UserID']}|${a['DepartmentID']}|${a['d']}`, { ach: num(a['achievedUnits']), units: num(a['targetUnits']) });
    const k = `${a['UserID']}|${a['d']}`;
    achievedByUserDate.set(k, (achievedByUserDate.get(k) ?? 0) + num(a['achievedUnits']));
  }
  return { leave, goals, units, taskUnits, tam, revisions, targetUnits, achievedByUserDate };
}

/** Java attachGoalPercent: the goal % of one user's day; the rules are in the calculation logic */
function goalPercentOf(row: Row, s: Support): number {
  const { UserID: userId, DepartmentID: departmentId, WorkDate: date } = row as { UserID: number; DepartmentID: number; WorkDate: string };
  return calculateGoal({
    kind: 'day', userId, departmentId, date, targetAchievedPercent: row['TargetAchievedPercent'],
    goalRows: (s.goals.get(`${userId}|${date}`) ?? []) as unknown as DayGoalRow[], units: s.units.get(`${userId}|${date}|${departmentId}`),
  });
}

const parseJson = (v: unknown) => { try { return v ? JSON.parse(String(v)) : null; } catch { return null; } };

// ── Per-user filter mode ──────────────────────────────────────────────────────

function filterNumeric(list: Row[], field: string, f: { operator: string; value: string }) {
  const value = Number(f.value);
  if (Number.isNaN(value)) return list;
  return list.filter((r) => {
    const v = num(r[field]);
    switch (f.operator) { case '>': return v > value; case '<': return v < value; case '>=': return v >= value; case '<=': return v <= value; case '=': return v === value; default: return true; }
  });
}

function applyUserLevelFilter(list: Row[], f: { field: string; operator: string; value: string }) {
  switch (f.field) {
    case 'Target Achieved': return filterNumeric(list, 'AvgTargetPercent', f);
    case 'Goal Achieved': return filterNumeric(list, 'AvgGoalPercent', f);
    case 'Utilization': return filterNumeric(list, 'AvgUtilizationPercent', f);
    case 'Efficiency': return list.filter((r) => String(r['EfficiencyLevel']).toLowerCase() === String(f.value).toLowerCase());
    case 'Name': return list.filter((r) => String(r['UserName']).toLowerCase().includes(String(f.value).toLowerCase()));
    case 'Department': return list.filter((r) => String(r['DepartmentName']).toLowerCase().includes(String(f.value).toLowerCase()));
    default: return list;
  }
}

async function scalar(sql: string, params: unknown[]): Promise<number> {
  const [rows] = await pool.query<DbRow[]>(sql, params);
  return num(Object.values(rows[0] ?? {})[0]);
}

const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Java getUserGoalEfficiency: one user's goal % in one department over a date range */
async function userGoalEfficiency(uid: number, dept: number | null, from: string, to: string): Promise<number> {
  const context = (await loadGoalContexts([uid], from, to)).get(uid) ?? EMPTY_USER_GOAL_CONTEXT;
  return calculateGoal({ kind: 'user', userId: uid, departmentId: dept ?? 0, from, to, context });
}

/** Iteration order of a java.util.HashMap with Integer keys (Java's groupingBy), given the keys in first-seen order */
function javaIntegerKeyOrder(keys: number[]): number[] {
  let capacity = 16;
  while (keys.length > capacity * 0.75) capacity *= 2;
  const bucket = (k: number) => ((k ^ (k >>> 16)) & (capacity - 1));
  return keys.map((k, i) => ({ k, i })).sort((a, b) => bucket(a.k) - bucket(b.k) || a.i - b.i).map((x) => x.k);
}

const groupBy = <T>(items: T[], key: (t: T) => number) => {
  const m = new Map<number, T[]>();
  for (const i of items) push(m, key(i), i);
  return m;
};

// ── Monthly breakdown (Java: summary target / goal become the mean of the months) ─────────────

async function monthlyBreakdown(list: Row[], f: EfficiencySummaryRequest, summary: Row) {
  const byMonth = new Map<string, Row[]>();
  for (const r of list) push(byMonth, String(r['WorkDate']).slice(0, 7), r);

  const months: Row[] = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, rows]) => {
    let target = 0, util = 0, allocated = 0, work = 0, goal = 0, targetCount = 0, goalCount = 0;
    for (const r of rows) {
      const t = num(r['TargetAchievedPercent']);
      target += t; if (t > 0) targetCount++;
      util += num(r['UtilizationPercent']); allocated += num(r['AllocatedTimeHrs']); work += num(r['TotalTimeOfWork']);
      const g = num(r['GoalPercent']);
      goal += g; if (g > 0) goalCount++;
    }
    const avgTarget = targetCount ? round2(target / targetCount) : 0, avgUtil = round2(util / rows.length);
    return {
      Year: Number(key.slice(0, 4)), MonthNumber: Number(key.slice(5, 7)),
      AvgTargetPercent: avgTarget, AvgUtilizationPercent: avgUtil, AvgAllocatedHrs: round2(allocated / rows.length), AvgTotalWork: round2(work / rows.length),
      EfficiencyLevel: avgTarget >= 100 && avgUtil >= 80 ? 'High' : avgTarget >= 80 && avgUtil >= 50 ? 'At Par' : 'Low',
      AvgGoalPercent: goalCount ? round2(goal / goalCount) : 0,
    };
  });
  const keyOf = (m: Row) => `${m['Year']}-${m['MonthNumber']}`;
  const level = (t: number, u: number) => (t >= 100 && u >= 80 ? 'High' : t >= 80 && u >= 50 ? 'At Par' : 'Low');
  const uid = f.userID || null;
  const range: [string, string] = [f.startDate!, f.endDate!];

  if (uid) {
    // monthly goal straight from UserGoalData, so goal-only days are not missed
    const [goalMonths] = await pool.query<DbRow[]>(
      `SELECT YEAR(ug.WorkDate) AS y, MONTH(ug.WorkDate) AS m, ROUND(AVG(CASE WHEN ${EFFECTIVE_GOAL} > 0 THEN (ug.AchievedGoal * 100.0) / ${EFFECTIVE_GOAL} ELSE 0 END), 2) AS monthAvg
       FROM UserGoalData ug WHERE ug.UserID = ? AND ug.WorkDate BETWEEN ? AND ? GROUP BY YEAR(ug.WorkDate), MONTH(ug.WorkDate)`, [uid, ...range]);
    const goalBy = new Map(goalMonths.map((r) => [`${r['y']}-${r['m']}`, num(r['monthAvg'])]));
    for (const m of months) if (goalBy.has(keyOf(m))) m['AvgGoalPercent'] = goalBy.get(keyOf(m));

    // April–June months for users whose goal is worked out from their own units (Java targetCalcUserIds)
    if ([153, 154, 155, 130, 97, 118].includes(uid)) {
      for (const m of months) {
        const mo = num(m['MonthNumber']);
        if (mo < 4 || mo > 6) continue;
        const y = num(m['Year']);
        let monthStart = `${y}-${pad2(mo)}-01`, monthEnd = `${y}-${pad2(mo)}-${pad2(lastDayOf(y, mo))}`;
        if (monthEnd > range[1]) monthEnd = range[1];
        if (monthStart < range[0]) monthStart = range[0];
        let goalPercent = 0;
        if (uid === 130 || uid === 97 || uid === 118) {
          goalPercent = num(m['AvgTargetPercent']); // goal = target for these users
        } else {
          const taskId = uid === 155 ? 21 : 65;
          const units = await scalar('SELECT COALESCE(SUM(u.AchivedUnits),0) FROM UserWorkData u WHERE u.UserID = ? AND u.TaskID = ? AND u.WorkDate BETWEEN ? AND ?', [uid, taskId, monthStart, monthEnd]);
          const fixed = round2(units * 0.35);
          const achieved = await scalar('SELECT COALESCE(SUM(g.AchievedGoal),0) FROM UserGoalData g WHERE g.UserID = ? AND g.WorkDate BETWEEN ? AND ?', [uid, monthStart, monthEnd]);
          if (fixed > 0) goalPercent = round2(ratio4(achieved, fixed) * 100);
        }
        m['AvgGoalPercent'] = goalPercent;
      }
    }

    // months spent in department 22 use that department's monthly rule
    const [d22] = await pool.query<DbRow[]>(
      `SELECT YEAR(ug.WorkDate) AS y, MONTH(ug.WorkDate) AS m,
              ROUND(AVG(CASE WHEN ug.AchievedGoal < 40 THEN 100 ELSE GREATEST(100 - (FLOOR((ug.AchievedGoal - 40) / 10) * 10), 0) END), 2) AS monthAvg
       FROM UserGoalData ug WHERE ug.UserID = ? AND ug.DepartmentID = 22 AND ug.WorkDate BETWEEN ? AND ? GROUP BY YEAR(ug.WorkDate), MONTH(ug.WorkDate)`, [uid, ...range]);
    const d22By = new Map(d22.map((r) => [`${r['y']}-${r['m']}`, num(r['monthAvg'])]));
    let overridden = 0;
    for (const m of months) if (d22By.has(keyOf(m))) { m['AvgTargetPercent'] = m['AvgGoalPercent'] = d22By.get(keyOf(m)); overridden++; }
    if (overridden > 0 && overridden === months.length) {
      const mean = round2(months.reduce((n, m) => n + num(m['AvgTargetPercent']), 0) / months.length);
      summary['AvgTargetPercent'] = summary['AvgGoalPercent'] = mean;
    }

    // revised target / goal of the month: attached for every revision, applied once EL-approved
    const revised = async (table: 'UserWorkData' | 'UserGoalData', column: 'RevisedTarget' | 'RevisedGoal', idCol: string, label: 'Target' | 'Goal') => {
      const alias = table === 'UserWorkData' ? 'w' : 'ug';
      const [rows] = await pool.query<DbRow[]>(
        `SELECT YEAR(${alias}.WorkDate) AS y, MONTH(${alias}.WorkDate) AS m, ${alias}.${column} AS raw,
                CAST(JSON_UNQUOTE(JSON_EXTRACT(${alias}.${column}, '$.value')) AS DECIMAL(10,2)) AS revisedValue,
                JSON_UNQUOTE(JSON_EXTRACT(${alias}.${column}, '$.elApproved')) AS elApproved
         FROM ${table} ${alias} WHERE ${alias}.UserID = ? AND ${alias}.WorkDate BETWEEN ? AND ? AND ${alias}.${column} IS NOT NULL AND ${alias}.${column} <> ''
           AND JSON_UNQUOTE(JSON_EXTRACT(${alias}.${column}, '$.value')) IS NOT NULL AND CAST(JSON_UNQUOTE(JSON_EXTRACT(${alias}.${column}, '$.value')) AS DECIMAL(10,2)) > 0
         ORDER BY ${alias}.${idCol}`, [uid, ...range]);
      const approved = new Map<string, DbRow>(), pending = new Map<string, DbRow>();
      for (const r of rows) {
        const k = `${r['y']}-${r['m']}`;
        const bucket = String(r['elApproved']).toLowerCase() === 'true' ? approved : pending;
        if (!bucket.has(k)) bucket.set(k, r);
      }
      for (const m of months) {
        const rev = approved.get(keyOf(m)) ?? pending.get(keyOf(m));
        if (!rev) continue;
        const value = num(rev['revisedValue']);
        m[`revised${label}`] = parseJson(rev['raw']);
        m[`revised${label}Value`] = value;
        if (String(rev['elApproved']).toLowerCase() !== 'true') continue;
        if (label === 'Target') { m['AvgTargetPercent'] = value; m['EfficiencyLevel'] = level(value, num(m['AvgUtilizationPercent'])); }
        else m['AvgGoalPercent'] = value;
      }
    };
    await revised('UserWorkData', 'RevisedTarget', 'DailyTaskLogID', 'Target');
    await revised('UserGoalData', 'RevisedGoal', 'UserGoalDataID', 'Goal');
  }

  if (months.length) {
    summary['AvgTargetPercent'] = round2(months.reduce((n, m) => n + num(m['AvgTargetPercent']), 0) / months.length);
    summary['AvgGoalPercent'] = round2(months.reduce((n, m) => n + num(m['AvgGoalPercent']), 0) / months.length);
  }

  // one work entry per month so the client can deep-link to it
  let logIds = new Map<string, number>();
  if (uid) {
    const [ids] = await pool.query<DbRow[]>(
      'SELECT MIN(w.DailyTaskLogID) AS id, YEAR(w.WorkDate) AS y, MONTH(w.WorkDate) AS m FROM UserWorkData w WHERE w.UserID = ? AND w.WorkDate BETWEEN ? AND ? GROUP BY YEAR(w.WorkDate), MONTH(w.WorkDate)', [uid, ...range]);
    logIds = new Map(ids.filter((r) => r['id'] != null).map((r) => [`${r['y']}-${r['m']}`, Number(r['id'])]));
  }
  for (const m of months) m['DailyTaskLogID'] = logIds.get(keyOf(m)) ?? null;
  return months;
}

// ── Entry points ──────────────────────────────────────────────────────────────

/** An EL id from the request, or from an EL / ExecutiveLeader filter */
function extractElId(f: EfficiencySummaryRequest): number | null {
  if (f.eLID) return f.eLID;
  const el = (f.filters ?? []).find((x) => ['el', 'executiveleader'].includes(String(x.field).toLowerCase()));
  const id = el ? parseInt(el.value, 10) : NaN;
  return Number.isNaN(id) ? null : id;
}

async function dayRows(f: EfficiencySummaryRequest): Promise<Row[]> {
  const result = await queryRows(f, f.eLID ?? null);
  return result.map((r): Row => ({
    UserID: r['UserID'], UserName: r['UserName'], DepartmentID: r['DepartmentID'], DepartmentName: r['DepartmentName'],
    WorkDate: ymd(r['WorkDate']),
    TargetAchievedPercent: toNum(r['TargetAchievedPercent']), UtilizationPercent: toNum(r['UtilizationPercent']),
    AllocatedTimeHrs: toNum(r['AllocatedTimeHrs']), TotalTimeOfWork: toNum(r['TotalTimeOfWork']), EfficiencyLevel: r['EfficiencyLevel'],
  }));
}

export async function listEfficiencySummary(f: EfficiencySummaryRequest) {
  const elWithoutDept = f.isHeExecutiveLeader === true && !f.departmentID;
  if (elWithoutDept) return listEfficiencySummaryEl(f);

  if (['week', 'month'].includes((f.groupBy ?? 'day').toLowerCase())) return periodResult(await queryRows(f, f.eLID ?? null));

  const base = await dayRows(f);
  const hasDates = !!(f.startDate && f.endDate);
  let filtered: Row[] = [];

  if (base.length) {
    const s = await loadSupport(base, f);
    for (const r of base) r['LeaveType'] = s.leave.get(`${r['UserID']}|${r['WorkDate']}`) ?? null;
    for (const r of base) r['GoalPercent'] = goalPercentOf(r, s);
    for (const r of base) calculateTarget({ kind: 'day', row: r, support: s });
    for (const r of base) calculateTarget({ kind: 'revision', row: r, support: s });
    filtered = base.filter((r) => !isFullDay(r['LeaveType']));
  }

  // ── a filter on the table: one summary row per user, filtered on those averages ──
  if (f.filters?.length) {
    const byUser = groupBy(filtered, (r) => r['UserID']);
    let users: Row[] = javaIntegerKeyOrder([...byUser.keys()]).map((id) => byUser.get(id)!).map((rows) => {
      const avg = computeRowAverages(rows);
      const avgGoal = round2(rows.reduce((n, r) => n + num(r['GoalPercent']), 0) / rows.length);
      return {
        UserID: rows[0]!['UserID'], UserName: rows[0]!['UserName'], DepartmentID: rows[0]!['DepartmentID'], DepartmentName: rows[0]!['DepartmentName'],
        TargetAchievedPercent: avg.AvgTargetPercent, UtilizationPercent: avg.AvgUtilizationPercent, AllocatedTimeHrs: avg.AvgAllocatedHrs, TotalTimeOfWork: avg.AvgTotalWork,
        EfficiencyLevel: avg.EfficiencyLevel, GoalPercent: avgGoal,
        AvgTargetPercent: avg.AvgTargetPercent, AvgUtilizationPercent: avg.AvgUtilizationPercent, AvgAllocatedHrs: avg.AvgAllocatedHrs, AvgTotalWork: avg.AvgTotalWork, _score: avg._score, AvgGoalPercent: avgGoal,
      };
    });
    for (const flt of f.filters) users = applyUserLevelFilter(users, flt);

    const summary = averageOfMaps(users); // Java leaves _score in this summary
    const out = { ...summary, AvgGoalPercent: users.length ? round2(users.reduce((n, u) => n + num(u['AvgGoalPercent']), 0) / users.length) : 0 };
    for (const u of users) for (const k of ['AvgTargetPercent', 'AvgUtilizationPercent', 'AvgAllocatedHrs', 'AvgTotalWork', 'AvgGoalPercent', '_score']) delete u[k];
    return { data: users, summary: out };
  }

  // ── hierarchical summary: user -> department -> EL -> company ──
  let summaryRow: Row;
  if (f.userID) {
    summaryRow = computeRowAverages(filtered);
  } else {
    const byUser = groupBy(filtered.filter((r) => r['UserID'] != null), (r) => r['UserID']);
    const userAvg = [...byUser.entries()].map(([uid, rows]) => ({ uid, dept: rows[0]!['DepartmentID'] as number | null, avg: computeRowAverages(rows) }));
    if (f.departmentID) {
      summaryRow = averageOfMaps(userAvg.map((u) => u.avg));
    } else {
      const deptAvg = [...groupBy(userAvg.filter((u) => u.dept != null), (u) => u.dept!).entries()].map(([dept, users]) => ({ ...averageOfMaps(users.map((u) => u.avg)), DepartmentID: dept }));
      const elId = extractElId(f);
      if (elId) {
        const [depts] = await pool.query<DbRow[]>('SELECT DepartmentID FROM Department WHERE ExecutiveLeaderID = ?', [elId]);
        const ids = new Set(depts.map((d) => d['DepartmentID'] as number));
        summaryRow = averageOfMaps(deptAvg.filter((d) => ids.has(d.DepartmentID)));
      } else {
        const [maps] = await pool.query<DbRow[]>('SELECT DepartmentID, ExecutiveLeaderID FROM Department WHERE ExecutiveLeaderID IS NOT NULL');
        const deptToEl = new Map(maps.map((m) => [m['DepartmentID'] as number, m['ExecutiveLeaderID'] as number]));
        const byEl = new Map<number, Row[]>();
        for (const d of deptAvg) { const el = deptToEl.get(d.DepartmentID); if (el != null) push(byEl, el, d); }
        summaryRow = averageOfMaps([...byEl.values()].map((ds) => averageOfMaps(ds)));
      }
    }
  }
  delete summaryRow['_score'];
  delete summaryRow['DepartmentID'];

  // goal: plain average of the day rows (Java's `history` mode is not ported)
  summaryRow['AvgGoalPercent'] = filtered.length ? round2(filtered.reduce((n, r) => n + num(r['GoalPercent']), 0) / filtered.length) : 0;

  if (f.history && f.userID) {
    const uid = f.userID;
    let deptIds = [...new Set(filtered.map((r) => r['DepartmentID'] as number).filter((d) => d != null))];
    if (!deptIds.length) {
      const [d] = await pool.query<DbRow[]>('SELECT DISTINCT DepartmentID FROM EfficiencyUtilizationSummary WHERE UserID = ?', [uid]);
      deptIds = d.map((x) => x['DepartmentID'] as number);
    }
    let total = 0, count = 0;
    try {
      for (const dept of deptIds) {
        const dates = filtered.filter((r) => r['DepartmentID'] === dept).map((r) => r['WorkDate'] as string).sort();
        const from = dates[0] ?? f.startDate ?? '2020-01-01';
        const to = dates[dates.length - 1] ?? f.endDate ?? new Date().toISOString().slice(0, 10);
        const goal = await userGoalEfficiency(uid, dept, from, to);
        total += goal; count++;
        summaryRow[String(dept)] = round2(goal);
      }
      summaryRow['AvgGoalPercent'] = count ? round2(total / count) : 0;
    } catch { summaryRow['AvgGoalPercent'] = 0; }
  }

  if (hasDates) {
    const months = await monthlyBreakdown(filtered, f, summaryRow);
    if (f.isQuarterly) summaryRow['monthlyBreakdown'] = months;
  }
  return { data: filtered, summary: summaryRow };
}

/** Executive Leader with no department picked: every department they lead that has data, with its users' averages */
export async function listEfficiencySummaryEl(f: EfficiencySummaryRequest) {
  if (!(f.isHeExecutiveLeader && f.userID)) return { status: true, departments: [] };

  const [depts] = await pool.query<DbRow[]>(
    `SELECT DISTINCT d.DepartmentID, d.DepartmentName FROM Department d JOIN EfficiencyUtilizationSummary e ON d.DepartmentID = e.DepartmentID
     WHERE d.ExecutiveLeaderID = ? AND e.DayType = 'Working' AND e.WorkDate BETWEEN ? AND ?`, [f.userID, f.startDate, f.endDate]);
  if (!depts.length) return { status: false, message: 'No departments assigned to this Executive Leader' };

  const departments = [];
  for (const dept of depts) {
    const [users] = await pool.query<DbRow[]>(
      `SELECT DISTINCT u.UserID, u.UserName FROM Users u JOIN EfficiencyUtilizationSummary e ON u.UserID = e.UserID
       WHERE e.DepartmentID = ? AND e.DayType = 'Working' AND e.WorkDate BETWEEN ? AND ? AND u.UserID <> ?`, [dept['DepartmentID'], f.startDate, f.endDate, f.userID]);
    const [rows] = users.length
      ? await pool.query<DbRow[]>(
        `SELECT UserID, DATE_FORMAT(WorkDate,'%Y-%m-%d') AS WorkDate, TargetAchievedPercent, UtilizationPercent, AllocatedTimeHrs, TotalTimeOfWork, EfficiencyLevel, DepartmentID
         FROM EfficiencyUtilizationSummary WHERE UserID IN (?) AND DepartmentID = ? AND DayType = 'Working' AND WorkDate BETWEEN ? AND ?`,
        [users.map((u) => u['UserID']), dept['DepartmentID'], f.startDate, f.endDate])
      : [[] as DbRow[]];
    const [leaveRows] = users.length
      ? await pool.query<DbRow[]>(`SELECT UserID, DATE_FORMAT(WorkDate,'%Y-%m-%d') AS d, LeaveType FROM UserWorkData WHERE UserID IN (?) AND WorkDate BETWEEN ? AND ? ORDER BY DailyTaskLogID`, [users.map((u) => u['UserID']), f.startDate, f.endDate])
      : [[] as DbRow[]];
    const leave = new Map<string, unknown>();
    for (const r of leaveRows) { const k = `${r['UserID']}|${r['d']}`; if (!leave.has(k)) leave.set(k, r['LeaveType']); }

    departments.push({
      ELID: f.userID,
      DepartmentID: dept['DepartmentID'],
      DepartmentName: dept['DepartmentName'],
      Users: users.map((u) => {
        const mine = rows.filter((r) => r['UserID'] === u['UserID'] && !isFullDay(leave.get(`${r['UserID']}|${r['WorkDate']}`)));
        const avg = computeRowAverages(mine);
        return { UserID: u['UserID'], UserName: u['UserName'], AvgTargetPercent: avg.AvgTargetPercent, AvgUtilizationPercent: avg.AvgUtilizationPercent, AvgAllocatedHrs: avg.AvgAllocatedHrs, TotalTimeOfWork: avg.AvgTotalWork, EfficiencyLevel: avg.EfficiencyLevel };
      }),
    });
  }
  return { status: true, departments };
}
