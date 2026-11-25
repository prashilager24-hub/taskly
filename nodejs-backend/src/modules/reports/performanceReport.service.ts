/**
 * Dashboard → Performance Report: % of target / goal achieved and working / allocated hours, for the whole company, a
 * department, a sub department or one person, with the target and goal entries behind them.
 *
 * Every database entry counts once — entries are never merged by name, goal or month:
 *  - day rows: EfficiencyUtilizationSummary, with leave and full-day leave dropped (enrichedDayRows); used for hours and
 *    for which days count ("exclude days with no target" leaves out days with no target)
 *  - % of target: each target entry (UserWorkData, IsForTarget = 1) is achieved ÷ expected × 100; a period is the plain
 *    average of its entries (an entry with no expected units has no %)
 *  - % of goal: each goal entry is achieved ÷ goal × 100 (the EL-approved revised goal when there is one, goal 0 → 0);
 *    a period is the plain average of its entries
 *  - a year or the whole range (the cards) is the average of its quarters; a quarter with no entries is left out
 *  - hours: the average of the day rows
 * Above one person, each person counts once: people → sub department → department → company, each level the average
 * of the level below. A person who worked in two sub departments counts in each, with their days there.
 *
 * Tables (date column WorkDate everywhere):
 *  EfficiencyUtilizationSummary (PK SummaryID; UserID → Users, DepartmentID → Department)        day rows
 *  UserWorkData (PK DailyTaskLogID; UserID, DepartmentID, TaskID = DepartmentTarget.TargetID when IsForTarget = 1) target entries
 *  UserGoalData (PK UserGoalDataID; UserID, DepartmentID, GoalID → DepartmentGoal)                    goal entries
 *  Department (= sub department; PrimaryDepartmentId → PrimaryDepartment = department; none → "No Department")
 */
import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { EFFECTIVE_GOAL, OVER_TARGET_MINUS_10, dayTargetRule } from '../calculations/calculationLogic';
import { teamOf } from '../access/team';
import { enrichedDayRows } from './efficiencySummary.service';
import { computePms, renderHumanReason, renderReason, type HumanReason, type MetricDetail, type PmsResult } from '../pms/pmsScore';

type DbRow = mysql.RowDataPacket;
type Row = Record<string, any>;
export type Grain = 'day' | 'month' | 'quarter' | 'year';

export interface PerformanceReportRequest {
  from: string; to: string;
  departmentId?: number | null;    // PrimaryDepartmentId; 0 = No Department
  subDepartmentId?: number | null; // Department.DepartmentID
  userId?: number | null;
  grain: Grain;
  excludeZero?: boolean;
  quarters?: number[] | null; // only these quarters (1–4) of the dates; empty / missing = every date in the range
  /** internal: leave out last period's score (used when working that score out) */
  skipTrend?: boolean;
}

export const NO_DEPARTMENT = 0;
const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r2 = (v: number | null) => (v == null ? null : Math.round(Number((v * 100).toPrecision(12))) / 100);
const pad = (x: number) => String(x).padStart(2, '0');
export const periodOf = (ymd: string, g: Grain) => (g === 'day' ? ymd.slice(0, 10) : g === 'year' ? ymd.slice(0, 4) : g === 'month' ? ymd.slice(0, 7) : `${ymd.slice(0, 4)}-Q${Math.ceil(Number(ymd.slice(5, 7)) / 3)}`);

/** Whose data the viewer may see: null = everyone (Admin / Super Admin), otherwise themselves and their team */
export async function scopeOf(viewerId: number, role: number): Promise<Set<number> | null> {
  const team = await teamOf(viewerId, role);
  return team === 'all' ? null : new Set([viewerId, ...team]);
}

interface Org { sub: Map<number, { name: string; dept: number }>; dept: Map<number, string> }
async function loadOrg(): Promise<Org> {
  const [subs] = await pool.query<DbRow[]>('SELECT DepartmentID, DepartmentName, PrimaryDepartmentId FROM Department');
  const [depts] = await pool.query<DbRow[]>('SELECT PrimaryDepartmentId, PrimaryDepartmentName FROM PrimaryDepartment');
  const dept = new Map<number, string>(depts.map((d) => [Number(d['PrimaryDepartmentId']), String(d['PrimaryDepartmentName'])]));
  dept.set(NO_DEPARTMENT, 'No Department');
  const sub = new Map<number, { name: string; dept: number }>();
  for (const s of subs) {
    const p = s['PrimaryDepartmentId'] == null ? NO_DEPARTMENT : Number(s['PrimaryDepartmentId']);
    sub.set(Number(s['DepartmentID']), { name: String(s['DepartmentName']), dept: dept.has(p) ? p : NO_DEPARTMENT });
  }
  return { sub, dept };
}

/** One person (or one person in one sub department): the unit every average starts from */
interface Unit { key: string; userId: number; userName: string; sub: number | null; dept: number | null }

/** The average of the level below: units → sub departments → departments → company (only units that have a value count) */
function rollup<T extends Unit>(units: T[], value: (u: T) => number | null, level: 'person' | 'sub' | 'dept' | 'company'): number | null {
  const have = units.map((u) => ({ u, v: value(u) })).filter((x): x is { u: T; v: number } => x.v != null);
  if (!have.length) return null;
  if (level === 'person' || level === 'sub') return mean(have.map((x) => x.v));
  const bySub = new Map<number, number[]>();
  for (const x of have) { const k = x.u.sub ?? -1; bySub.set(k, [...(bySub.get(k) ?? []), x.v]); }
  const subAvg = [...bySub.entries()].map(([sub, vs]) => ({ sub, v: mean(vs)! }));
  if (level === 'dept') return mean(subAvg.map((s) => s.v));
  const deptOf = new Map(have.map((x) => [x.u.sub ?? -1, x.u.dept ?? NO_DEPARTMENT]));
  const byDept = new Map<number, number[]>();
  for (const s of subAvg) { const d = deptOf.get(s.sub)!; byDept.set(d, [...(byDept.get(d) ?? []), s.v]); }
  return mean([...byDept.values()].map((vs) => mean(vs)!));
}

/** The PMS score (in %) of another period, for the trend line (typed apart so the report can call itself) */
async function previousScoreOf(f: PerformanceReportRequest, scope: Set<number> | null): Promise<number | null> {
  const r: { pms: { score: number | null } } = await performanceReport(f, scope);
  return r.pms.score;
}

export async function performanceReport(f: PerformanceReportRequest, scope: Set<number> | null) {
  const org = await loadOrg();
  const subDept = (id: number) => org.sub.get(id) ?? { name: `Sub department ${id}`, dept: NO_DEPARTMENT };
  const inScope = (uid: number) => !scope || scope.has(uid);
  const inOrg = (sub: number) => (f.subDepartmentId ? sub === f.subDepartmentId : f.departmentId != null ? subDept(sub).dept === f.departmentId : true);
  const qSet = f.quarters?.length ? new Set(f.quarters) : null;
  const inQuarters = (ymd: string) => !qSet || qSet.has(Math.ceil(Number(String(ymd).slice(5, 7)) / 3));
  const level: 'person' | 'sub' | 'dept' | 'company' = f.userId ? 'person' : f.subDepartmentId ? 'sub' : f.departmentId != null ? 'dept' : 'company';

  // ── day rows ──
  let days = await enrichedDayRows({ startDate: f.from, endDate: f.to, userID: f.userId ?? null, departmentID: f.subDepartmentId ?? null });
  days = days.filter((r) => inScope(n(r['UserID'])) && inOrg(n(r['DepartmentID'])) && inQuarters(String(r['WorkDate'])));
  const allDays = days.length;
  if (f.excludeZero) days = days.filter((r) => n(r['TargetAchievedPercent']) > 0);

  const unitKey = (uid: number, sub: number) => (f.userId ? `u${uid}` : `u${uid}|s${sub}`);
  const units = new Map<string, Unit & { rows: Row[]; goals: { date: string; goalId: number; pct: number }[] }>();
  const unitFor = (uid: number, name: string, sub: number) => {
    const key = unitKey(uid, sub);
    let u = units.get(key);
    if (!u) { u = { key, userId: uid, userName: name, sub: f.userId ? null : sub, dept: f.userId ? null : subDept(sub).dept, rows: [], goals: [] }; units.set(key, u); }
    return u;
  };
  for (const r of days) unitFor(n(r['UserID']), String(r['UserName']), n(r['DepartmentID'])).rows.push(r);

  // ── goal entries ──
  const gConds = ['ug.WorkDate BETWEEN ? AND ?']; const gParams: (string | number)[] = [f.from, f.to];
  if (f.userId) { gConds.push('ug.UserID = ?'); gParams.push(f.userId); }
  if (f.subDepartmentId) { gConds.push('ug.DepartmentID = ?'); gParams.push(f.subDepartmentId); }
  const [goalRows] = await pool.query<DbRow[]>(
    `SELECT ug.UserGoalDataID, ug.UserID, u.UserName, ug.DepartmentID, ug.GoalID, DATE_FORMAT(ug.WorkDate,'%Y-%m-%d') AS WorkDate,
            ${EFFECTIVE_GOAL} AS Goal, ug.AchievedGoal, ug.Comment, g.GoalName, g.GoalMetric, g.Frequency
     FROM UserGoalData ug JOIN Users u ON u.UserID = ug.UserID LEFT JOIN DepartmentGoal g ON g.GoalID = ug.GoalID
     WHERE ${gConds.join(' AND ')} ORDER BY ug.WorkDate, ug.UserGoalDataID`, gParams);
  const goals = goalRows
    .filter((g) => inScope(n(g['UserID'])) && inOrg(n(g['DepartmentID'])) && inQuarters(String(g['WorkDate'])))
    .map((g): Row => ({ ...g, pct: n(g['Goal']) > 0 ? (n(g['AchievedGoal']) * 100) / n(g['Goal']) : 0 }));
  for (const g of goals) unitFor(n(g['UserID']), String(g['UserName']), n(g['DepartmentID'])).goals.push({ date: String(g['WorkDate']), goalId: n(g['GoalID']), pct: n(g['pct']) });

  const U = [...units.values()];
  type FullUnit = (typeof U)[number];

  // ── target entries (UserWorkData, IsForTarget = 1), only on the days the report counts; each entry counts once ──
  const counted = new Set(days.map((r) => `${r['UserID']}|${r['WorkDate']}`));
  const dayHours = new Map<string, { alloc: number; work: number }>();
  for (const r of days) { const k = `${r['UserID']}|${r['DepartmentID']}|${r['WorkDate']}`; const h = dayHours.get(k) ?? { alloc: 0, work: 0 }; h.alloc += n(r['AllocatedTimeHrs']); h.work += n(r['TotalTimeOfWork']); dayHours.set(k, h); }
  const tConds = ['w.IsForTarget = 1', 'w.WorkDate BETWEEN ? AND ?']; const tParams: (string | number)[] = [f.from, f.to];
  if (f.userId) { tConds.push('w.UserID = ?'); tParams.push(f.userId); }
  if (f.subDepartmentId) { tConds.push('w.DepartmentID = ?'); tParams.push(f.subDepartmentId); }
  const [targetRows] = await pool.query<DbRow[]>(
    `SELECT w.DailyTaskLogID, w.UserID, u.UserName, w.DepartmentID, w.TaskID, DATE_FORMAT(w.WorkDate,'%Y-%m-%d') AS WorkDate,
            w.Units, w.AchivedUnits, w.Remarks, tg.TargetName, tg.TargetMetric, tg.Frequency
     FROM UserWorkData w JOIN Users u ON u.UserID = w.UserID LEFT JOIN DepartmentTarget tg ON tg.TargetID = w.TaskID
     WHERE ${tConds.join(' AND ')} ORDER BY w.WorkDate, w.DailyTaskLogID`, tParams);
  // Days whose target a department rule sets (time taken vs planned in Apr – Jun, TAM, …) or an EL-approved revised
  // target changed: that day is one entry with the day's figure, in place of its target entries.
  const ruleDays = new Map<string, { row: Row; rule: string }>();
  for (const r of days) {
    const rule = r['originalTargetAchievedPercent'] != null ? 'Revised target (EL approved)'
      : dayTargetRule(n(r['DepartmentID']), String(r['WorkDate']), n(r['AllocatedTimeHrs']), r['GoalPercent']);
    if (rule) ruleDays.set(`${r['UserID']}|${r['DepartmentID']}|${r['WorkDate']}`, { row: r, rule });
  }
  const targets = targetRows.filter((w) => inScope(n(w['UserID'])) && inOrg(n(w['DepartmentID'])) && counted.has(`${n(w['UserID'])}|${w['WorkDate']}`)
    && !ruleDays.has(`${n(w['UserID'])}|${n(w['DepartmentID'])}|${w['WorkDate']}`));
  // an entry's % = achieved ÷ expected × 100 (departments 59 – 61: 10 points off when over the target);
  // an entry with no expected units has no % and is not averaged
  const entryPct = (w: Row) => { const u = n(w['Units']), a = n(w['AchivedUnits']); if (!(u > 0)) return null; const p = (a * 100) / u; return OVER_TARGET_MINUS_10.includes(n(w['DepartmentID'])) && a > u ? p - 10 : p; };
  type E = { date: string; pct: number };
  const tUnits = new Map<string, E[]>();
  const addT = (uid: number, name: string, sub: number, e: E) => { const u = unitFor(uid, name, sub); tUnits.set(u.key, [...(tUnits.get(u.key) ?? []), e]); };
  for (const w of targets) { const p = entryPct(w); if (p != null) addT(n(w['UserID']), String(w['UserName']), n(w['DepartmentID']), { date: String(w['WorkDate']), pct: p }); }
  for (const { row: r } of ruleDays.values()) addT(n(r['UserID']), String(r['UserName']), n(r['DepartmentID']), { date: String(r['WorkDate']), pct: n(r['TargetAchievedPercent']) });
  const U2 = [...units.values()] as FullUnit[];
  const targetsOf = (u: FullUnit) => tUnits.get(u.key) ?? [];
  const goalsOf = (u: FullUnit) => u.goals as E[];

  // ── Model X (People Hub PMS score, modules/pms/pmsScore.ts) ──
  // Goal % / Target % for a period: average each metric's entries (each goal / target is one metric), then average the
  // metrics, so every metric counts the same. Entries with nothing expected (0) are left out; the same entry twice
  // (same metric, date and figures) counts once. Score = Goal^w × Target^(1−w), w = 0.70 when Goal % > Target %,
  // else 0.50, plus the person's manager shift for the year the dates end in (±5%, PmsWeightage).
  type MX = { date: string; metric: string; key: string; pct: number; name: string; unit: string; expected: number | null; achieved: number | null };
  /** The unit to talk in: the metric field when it names something ("No_Of_Meetings_Scheduled" → "meetings scheduled"),
   *  otherwise "units" (many metric fields hold "100%", "100" or "Time") */
  const unitOf = (metric: unknown, _name?: unknown) => {
    const t = String(metric ?? '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().replace(/^(no|number) of /, '');
    return /^[a-z][a-z ]{3,40}$/.test(t) && !['time', 'n a', 'na', 'none', 'percentage', 'percent'].includes(t) ? t : 'units';
  };
  const mxT = new Map<string, MX[]>(), mxG = new Map<string, MX[]>();
  const push = (m: Map<string, MX[]>, k: string, e: MX) => m.set(k, [...(m.get(k) ?? []), e]);
  for (const w of targets) {
    const p = entryPct(w); if (p == null) continue;
    const metric = `t${w['TaskID'] ?? 'x'}`, date = String(w['WorkDate']);
    push(mxT, unitFor(n(w['UserID']), String(w['UserName']), n(w['DepartmentID'])).key, { date, metric, key: `${metric}|${date}|${n(w['Units'])}|${n(w['AchivedUnits'])}`, pct: p,
      name: String(w['TargetName'] ?? 'Target'), unit: unitOf(w['TargetMetric'], w['TargetName']), expected: n(w['Units']), achieved: n(w['AchivedUnits']) });
  }
  for (const { row: r, rule } of ruleDays.values()) {
    const metric = `rule:${rule}`, date = String(r['WorkDate']);
    push(mxT, unitFor(n(r['UserID']), String(r['UserName']), n(r['DepartmentID'])).key, { date, metric, key: `${metric}|${date}|${n(r['DepartmentID'])}`, pct: n(r['TargetAchievedPercent']),
      name: rule, unit: 'units', expected: null, achieved: null });
  }
  for (const g of goals) {
    if (!(n(g['Goal']) > 0)) continue;
    const metric = `g${g['GoalID']}`, date = String(g['WorkDate']);
    push(mxG, unitFor(n(g['UserID']), String(g['UserName']), n(g['DepartmentID'])).key, { date, metric, key: `${metric}|${date}|${n(g['Goal'])}|${n(g['AchievedGoal'])}`, pct: n(g['pct']),
      name: String(g['GoalName'] ?? 'Goal'), unit: unitOf(g['GoalMetric'], g['GoalName']), expected: n(g['Goal']), achieved: n(g['AchievedGoal']) });
  }
  const mxAvg = (list: MX[], keep: (e: MX) => boolean = () => true) => {
    const seen = new Set<string>(); const by = new Map<string, number[]>();
    for (const e of list) { if (!keep(e) || seen.has(e.key)) continue; seen.add(e.key); by.set(e.metric, [...(by.get(e.metric) ?? []), e.pct]); }
    const ms = [...by.values()].map((v) => mean(v)!);
    return { pct: mean(ms), metrics: ms.length, entries: seen.size };
  };
  const shiftYear = Number(f.to.slice(0, 4));
  const mxUserIds = [...new Set([...units.values()].map((u) => u.userId))];
  const [shiftRows] = mxUserIds.length
    ? await pool.query<DbRow[]>('SELECT UserID, GoalShift FROM PmsWeightage WHERE PeriodYear = ? AND UserID IN (?)', [shiftYear, mxUserIds])
    : [[] as DbRow[]];
  const shiftOf = new Map(shiftRows.map((r) => [n(r['UserID']), n(r['GoalShift'])]));
  const mxScore = (gList: MX[], tList: MX[], uid: number, keep?: (e: MX) => boolean) => {
    const g = mxAvg(gList, keep), t = mxAvg(tList, keep);
    return { goal: g, target: t, result: computePms({ goalPct: g.pct == null ? null : g.pct / 100, targetPct: t.pct == null ? null : t.pct / 100, managerShift: shiftOf.get(uid) ?? 0 }) };
  };
  const unitMx = (u: FullUnit, keep?: (e: MX) => boolean) => mxScore(mxG.get(u.key) ?? [], mxT.get(u.key) ?? [], u.userId, keep);
  const pctOf = (x: number | null) => (x == null ? null : r2(x * 100));

  // A period's % is the plain average of every entry in it (10 entries → divided by 10), worked out per person and
  // then person → sub department → department → company. A year or the whole range is the average of its quarters.
  const avgIn = (list: E[], keep: (e: E) => boolean) => mean(list.filter(keep).map((e) => e.pct));
  const byPeriod = (of: (u: FullUnit) => E[], g: Grain, p: string) => rollup(U2, (u) => avgIn(of(u), (e) => periodOf(e.date, g) === p), level);

  const quarterKeys = [...new Set([...U2.flatMap((u) => [...targetsOf(u), ...goalsOf(u)].map((e) => periodOf(e.date, 'quarter')))])].sort();
  const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const quarters = quarterKeys.map((q) => {
    const y = Number(q.slice(0, 4)), k = Number(q.slice(6)); const start = `${y}-${pad(k * 3 - 2)}-01`, end = `${y}-${pad(k * 3)}-${lastDayOf(y, k * 3)}`;
    const inQ = (e: E) => periodOf(e.date, 'quarter') === q;
    return {
      quarter: q, partial: f.from > start || f.to < end, target: r2(byPeriod(targetsOf, 'quarter', q)), goal: r2(byPeriod(goalsOf, 'quarter', q)),
      targetEntries: U2.reduce((a, u) => a + targetsOf(u).filter(inQ).length, 0), goalEntries: U2.reduce((a, u) => a + goalsOf(u).filter(inQ).length, 0),
    };
  });
  // weighted average: each quarter's % × its number of entries, summed, ÷ the number of entries
  // Brijesh 2026 target: (84.65 × 154 + 81.51 × 333 + 104.95 × 68) / 555 = 85.25; goal: (129.15 × 4 + 87.07 × 6) / 10 = 103.90
  // uses the quarter % as shown (2 decimals), so the working on the card adds up by hand
  const weighted = (k: 'target' | 'goal', cnt: 'targetEntries' | 'goalEntries') => {
    const used = quarters.filter((q) => q[k] != null && q[cnt] > 0);
    const n = used.reduce((a, q) => a + q[cnt], 0);
    const sum = used.reduce((a, q) => a + (q[k] as number) * q[cnt], 0);
    return { pct: n ? r2(sum / n) : null, sum: r2(sum), entries: n };
  };
  const avgOfQuarters = (k: 'target' | 'goal', year?: string) => r2(mean(quarters.filter((q) => (!year || q.quarter.startsWith(year)) && q[k] != null).map((q) => q[k] as number)));
  const valueFor = (k: 'target' | 'goal', p: string) =>
    f.grain === 'quarter' ? quarters.find((q) => q.quarter === p)?.[k] ?? null
      : f.grain === 'year' ? avgOfQuarters(k, p)
        : r2(byPeriod(k === 'target' ? targetsOf : goalsOf, f.grain, p));
  const hours = (k: 'TotalTimeOfWork' | 'AllocatedTimeHrs') => rollup(U2, (u) => mean(u.rows.map((r) => n(r[k]))), level);

  const periods = [...new Set(U2.flatMap((u) => [...targetsOf(u), ...goalsOf(u)].map((e) => periodOf(e.date, f.grain))))].sort();
  const people = new Set(U2.map((u) => u.userId)).size;

  // ── target table: one row per database entry ──
  const ruleRows = [...ruleDays.values()].map(({ row: r, rule }, i) => {
    const uid = n(r['UserID']), sub = n(r['DepartmentID']); const rev = rule.startsWith('Revised');
    return {
      id: -(i + 1), period: periodOf(String(r['WorkDate']), f.grain), date: String(r['WorkDate']), userId: uid, associate: r['UserName'],
      subDepartment: subDept(sub).name, department: org.dept.get(subDept(sub).dept), targetName: rule,
      frequency: 'Daily', days: 1, expected: rev ? r2(n(r['revisedTargetValue'])) : null, achieved: rev ? r2(n(r['achievedUnits'])) : null, pct: r2(n(r['TargetAchievedPercent'])),
      allocatedHrs: r2(n(r['AllocatedTimeHrs'])), takenHrs: r2(n(r['TotalTimeOfWork'])), remarks: '',
    };
  });
  const targetTable = [...ruleRows, ...targets.map((w) => {
    const uid = n(w['UserID']), sub = n(w['DepartmentID']), units = n(w['Units']), got = n(w['AchivedUnits']);
    const h = dayHours.get(`${uid}|${sub}|${w['WorkDate']}`);
    return {
      id: n(w['DailyTaskLogID']), period: periodOf(String(w['WorkDate']), f.grain), date: w['WorkDate'], userId: uid, associate: w['UserName'],
      subDepartment: subDept(sub).name, department: org.dept.get(subDept(sub).dept), targetName: w['TargetName'] ?? `Target not in target list (ID ${w['TaskID'] ?? '—'})`,
      frequency: w['Frequency'] ?? null, days: 1, expected: r2(units), achieved: r2(got), pct: r2(entryPct(w)),
      allocatedHrs: r2(h?.alloc ?? 0), takenHrs: r2(h?.work ?? 0), remarks: String(w['Remarks'] ?? '').trim(),
    };
  })].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.associate).localeCompare(String(b.associate)));

  // ── goal table: one row per database entry ──
  const goalTable = goals.map((g) => {
    const uid = n(g['UserID']), sub = n(g['DepartmentID']);
    return {
      id: n(g['UserGoalDataID']), period: periodOf(String(g['WorkDate']), f.grain), date: g['WorkDate'], userId: uid, associate: g['UserName'],
      subDepartment: subDept(sub).name, department: org.dept.get(subDept(sub).dept), goalName: g['GoalName'] ?? `Goal ${g['GoalID']}`,
      frequency: g['Frequency'] ?? null, expected: r2(n(g['Goal'])), achieved: r2(n(g['AchievedGoal'])), pct: r2(n(g['pct'])), entries: 1,
      remarks: String(g['Comment'] ?? '').trim(),
    };
  });
  const goalBreakdown = null;

  // ── each person's own scores, worked out as if only that person were picked (People Hub → Target & Goals) ──
  // quarter % = plain average of the person's entries in it; weighted = Σ (quarter % × entries) ÷ entries; average = mean of quarters
  const subsOf = new Map<number, Set<number>>();
  for (const r of [...days, ...goals]) { const uid = n(r['UserID']); subsOf.set(uid, (subsOf.get(uid) ?? new Set()).add(n(r['DepartmentID']))); }
  const byUser = new Map<number, { name: string; t: E[]; g: E[] }>();
  for (const u of U2) {
    const p = byUser.get(u.userId) ?? { name: u.userName, t: [], g: [] };
    p.t.push(...targetsOf(u)); p.g.push(...goalsOf(u)); byUser.set(u.userId, p);
  }
  const scoreOf = (list: E[]) => {
    const perQ = new Map<string, number[]>();
    for (const e of list) { const q = periodOf(e.date, 'quarter'); perQ.set(q, [...(perQ.get(q) ?? []), e.pct]); }
    const qv = [...perQ.values()].map((v) => ({ pct: r2(mean(v))!, n: v.length }));
    const entries = qv.reduce((a, q) => a + q.n, 0);
    return { weighted: entries ? r2(qv.reduce((a, q) => a + q.pct * q.n, 0) / entries) : null, avg: r2(mean(qv.map((q) => q.pct))), entries };
  };
  const personScores = [...byUser.entries()].map(([userId, p]) => {
    const subs = [...(subsOf.get(userId) ?? [])];
    const myUnits = U2.filter((u) => u.userId === userId);
    const m = mxScore(myUnits.flatMap((u) => mxG.get(u.key) ?? []), myUnits.flatMap((u) => mxT.get(u.key) ?? []), userId);
    return {
      userId, name: p.name,
      subDepartment: subs.map((s) => subDept(s).name).join(', '),
      department: [...new Set(subs.map((s) => org.dept.get(subDept(s).dept) ?? ''))].join(', '),
      target: scoreOf(p.t), goal: scoreOf(p.g),
      pms: {
        goalPct: pctOf(m.result.goalPct), targetPct: pctOf(m.result.targetPct), score: pctOf(m.result.score), goalWeight: m.result.goalWeight, shift: m.result.managerShift,
        reasonCode: m.result.reasonCode, goalMetrics: m.goal.metrics, targetMetrics: m.target.metrics,
      },
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // ── Model X for the whole selection: one person's own figures, or person → sub department → department → company ──
  const cardMx = (keep?: (e: MX) => boolean) => ({
    goalPct: r2(rollup(U2, (u) => { const v = unitMx(u, keep).result.goalPct; return v == null ? null : v * 100; }, level)),
    targetPct: r2(rollup(U2, (u) => { const v = unitMx(u, keep).result.targetPct; return v == null ? null : v * 100; }, level)),
    score: r2(rollup(U2, (u) => { const v = unitMx(u, keep).result.score; return v == null ? null : v * 100; }, level)),
  });
  const allMx = U2.map((u) => unitMx(u));
  /** The side's main metric: the one logged most often, with its planned and achieved totals for the period */
  const mainMetric = (list: MX[]): MetricDetail | undefined => {
    const seen = new Set<string>(); const by = new Map<string, MX[]>();
    for (const e of list) { if (seen.has(e.key) || e.expected == null) continue; seen.add(e.key); by.set(e.metric, [...(by.get(e.metric) ?? []), e]); }
    const top = [...by.values()].sort((a, b) => b.length - a.length)[0];
    if (!top) return undefined;
    const planned = top.reduce((a, e) => a + (e.expected ?? 0), 0), achieved = top.reduce((a, e) => a + (e.achieved ?? 0), 0);
    return planned > 0 ? { name: top[0]!.name, unit: top[0]!.unit, planned, achieved } : undefined;
  };
  let onePerson: { result: PmsResult; reason: ReturnType<typeof renderReason>; human: HumanReason; goalMetrics: number; targetMetrics: number; goalEntries: number; targetEntries: number } | null = null;
  if (level === 'person' && allMx[0] && U2[0]) {
    const u0 = U2[0];
    // last period: the same number of days just before these dates (for "Up 6 points since last period")
    let previousScore: number | null = null;
    if (!f.skipTrend) {
      const day = 86_400_000, start = Date.parse(`${f.from}T00:00:00Z`), end = Date.parse(`${f.to}T00:00:00Z`);
      const len = Math.round((end - start) / day) + 1;
      const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
      const prev = await previousScoreOf({ ...f, from: iso(start - len * day), to: iso(start - day), quarters: null, grain: 'quarter', skipTrend: true }, scope);
      previousScore = prev == null ? null : prev / 100;
    }
    const input = {
      goalPct: allMx[0].result.goalPct, targetPct: allMx[0].result.targetPct, managerShift: allMx[0].result.managerShift,
      goalMetric: mainMetric(mxG.get(u0.key) ?? []), targetMetric: mainMetric(mxT.get(u0.key) ?? []),
      previousScore, workingDays: new Set(u0.rows.map((r) => String(r['WorkDate']))).size || undefined,
    };
    onePerson = {
      result: allMx[0].result, reason: renderReason(allMx[0].result), human: renderHumanReason(allMx[0].result, input),
      goalMetrics: allMx[0].goal.metrics, targetMetrics: allMx[0].target.metrics, goalEntries: allMx[0].goal.entries, targetEntries: allMx[0].target.entries,
    };
  }
  const pms = {
    ...cardMx(), shiftYear, people: new Set(U2.map((u) => u.userId)).size,
    goalMetrics: allMx.reduce((a, m) => a + m.goal.metrics, 0), targetMetrics: allMx.reduce((a, m) => a + m.target.metrics, 0),
    goalEntries: allMx.reduce((a, m) => a + m.goal.entries, 0), targetEntries: allMx.reduce((a, m) => a + m.target.entries, 0),
    person: onePerson,
    charts: periods.map((pk) => ({ period: pk, ...cardMx((e) => periodOf(e.date, f.grain) === pk) })),
  };

  return {
    level,
    goalBreakdown,
    people: personScores,
    pms,
    cards: {
      avgTargetPct: avgOfQuarters('target'), avgGoalPct: avgOfQuarters('goal'), weightedTarget: weighted('target', 'targetEntries'), weightedGoal: weighted('goal', 'goalEntries'), targetEntries: targetTable.filter((t) => t.pct != null).length,
      avgWorkingHrs: r2(hours('TotalTimeOfWork')), avgAllocatedHrs: r2(hours('AllocatedTimeHrs')),
      dayRows: days.length, dayRowsBeforeExclude: allDays, daysWithTarget: days.filter((r) => n(r['TargetAchievedPercent']) > 0).length,
      goalEntries: goals.length, people,
    },
    quarters,
    charts: { target: periods.map((p) => ({ period: p, value: valueFor('target', p) })).filter((x) => x.value != null), goal: periods.map((p) => ({ period: p, value: valueFor('goal', p) })).filter((x) => x.value != null) },
    targetTable, goalTable,
  };
}

/** Filter lists: the departments, sub departments and people with data in the range, within the viewer's scope */
export async function performanceReportOptions(from: string, to: string, scope: Set<number> | null) {
  const org = await loadOrg();
  const [rows] = await pool.query<DbRow[]>(
    `SELECT x.UserID, u.UserName, x.DepartmentID FROM (
       SELECT DISTINCT UserID, DepartmentID FROM EfficiencyUtilizationSummary WHERE WorkDate BETWEEN ? AND ?
       UNION SELECT DISTINCT UserID, DepartmentID FROM UserGoalData WHERE WorkDate BETWEEN ? AND ?
     ) x JOIN Users u ON u.UserID = x.UserID ORDER BY u.UserName`, [from, to, from, to]);
  const seen = rows.filter((r) => !scope || scope.has(n(r['UserID'])));
  const subs = new Map<number, { id: number; name: string; departmentId: number }>();
  for (const r of seen) { const s = n(r['DepartmentID']); const o = org.sub.get(s) ?? { name: `Sub department ${s}`, dept: NO_DEPARTMENT }; subs.set(s, { id: s, name: o.name, departmentId: o.dept }); }
  const deptIds = new Set([...subs.values()].map((s) => s.departmentId));
  return {
    departments: [...deptIds].map((id) => ({ id, name: org.dept.get(id) ?? `Department ${id}` })).sort((a, b) => (a.id === NO_DEPARTMENT ? 1 : b.id === NO_DEPARTMENT ? -1 : a.name.localeCompare(b.name))),
    subDepartments: [...subs.values()].sort((a, b) => a.name.localeCompare(b.name)),
    people: seen.map((r) => ({ id: n(r['UserID']), name: String(r['UserName']), subDepartmentId: n(r['DepartmentID']) })),
    allCompany: !scope,
  };
}
