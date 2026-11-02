import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';
import { toBool, toLocalDateTime, toNum } from '../../utils/javaCompat';
import { computeRollup } from '../reports/dashboardRollup';
import { calculateGoal, round2, type RevisedGoal } from '../calculations/calculationLogic';

export interface GoalDataListFilter {
  userID?: number | null;
  departmentID?: number | null;
  goalID?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  goalStartDate?: string | null;
  goalEndDate?: string | null;
  eLID?: number | null;
  fLID?: number | null;
  searchText?: string | null;
}

type Row = mysql.RowDataPacket;
interface GoalDto {
  userGoalDataID: unknown; workDate: string | null; userID: unknown; userName: unknown; departmentID: number; goalID: number;
  goalName: unknown; fixedGoal: number; achievedGoal: number; goalEfficiencyPercent: number; recalculatedTarget: number | null;
  comment: unknown; approvedByEL: boolean | null; revisedGoal: RevisedGoal;
}
type GoalRow = GoalDto & { frequency: string | null };

// ── Date helpers ──────────────────────────────────────────────────────────────────────────────────
const ymd = (d: unknown) => toLocalDateTime(d)?.slice(0, 10) ?? null;

const quarterStart = (d: string) => {
  const [y, m] = d.split('-').map(Number) as [number, number];
  return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;
};
const addMonths = (d: string, n: number) => {
  const [y, m] = d.split('-').map(Number) as [number, number];
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`;
};
/** last day of the quarter the date is in */
const quarterEnd = (d: string) => {
  const next = addMonths(quarterStart(d), 3).split('-').map(Number) as [number, number, number];
  const e = new Date(Date.UTC(next[0], next[1] - 1, 1));
  e.setUTCDate(e.getUTCDate() - 1);
  return e.toISOString().slice(0, 10);
};
const monthKey = (d: string) => d.slice(0, 7);

/** One goal entry as the list shows it; the efficiency itself is in the calculation logic */
async function mapRow(r: Row, cache: Map<string, number>): Promise<GoalRow> {
  const dept = Number(r['DepartmentID']);
  const goalId = Number(r['GoalID']);
  const userId = Number(r['UserID']);
  const workDate = ymd(r['WorkDate'])!;
  const revised = parseJson(r['RevisedGoal']) as RevisedGoal;

  const taskUnits = async (task: number) => {
    const k = `${userId}|${workDate}|${dept}|${task}`;
    if (!cache.has(k)) {
      const [[x]] = await pool.query<Row[]>(
        'SELECT COALESCE(SUM(AchivedUnits), 0) AS n FROM UserWorkData WHERE UserID = ? AND WorkDate = ? AND DepartmentID = ? AND TaskID = ? AND IsForTarget = 1',
        [userId, workDate, dept, task]);
      cache.set(k, Number(x?.['n'] ?? 0));
    }
    return cache.get(k) as number;
  };
  const calc = await calculateGoal({
    kind: 'entry', userId, departmentId: dept, goalId, fixed: toNum(r['FixedGoal']), achieved: toNum(r['AchievedGoal']), revised, taskUnits,
  });

  return {
    userGoalDataID: r['UserGoalDataID'], workDate, userID: r['UserID'], userName: r['UserName'] ?? null, departmentID: dept, goalID: goalId,
    goalName: r['GoalName'] ?? null, fixedGoal: calc.fixed ?? 0, achievedGoal: calc.achieved ?? 0, goalEfficiencyPercent: calc.efficiency,
    recalculatedTarget: calc.recalculatedTarget, comment: r['Comment'] ?? null, approvedByEL: toBool(r['ApprovedByEL']), revisedGoal: revised,
    frequency: r['Frequency'] ?? null,
  };
}

const contribution = (d: GoalDto) =>
  (d.revisedGoal && d.revisedGoal.elApproved === true && d.revisedGoal.value != null ? Number(d.revisedGoal.value) : d.goalEfficiencyPercent);
const mean2 = (vals: number[]) => (vals.length ? round2(vals.reduce((n, v) => n + v, 0) / vals.length) : 0);

/** Java buildMonthlyContributions + monthlyBreakdownFrom: a quarterly goal is mirrored into the quarter's other months */
function monthly(dtos: GoalRow[], filter: GoalDataListFilter) {
  const by = new Map<string, { goalId: number; v: number }[]>();
  const within = (d: string) => (!filter.startDate || d >= filter.startDate) && (!filter.endDate || d <= filter.endDate);
  const hasApproved = (g: GoalDto) => !!g.revisedGoal && g.revisedGoal.elApproved === true && g.revisedGoal.value != null;
  const bucket = (k: string) => by.get(k) ?? by.set(k, []).get(k)!;
  let approved = false;

  for (const g of dtos) {
    if (!within(g.workDate!)) continue;
    bucket(monthKey(g.workDate!)).push({ goalId: g.goalID, v: contribution(g) });
    if (hasApproved(g)) approved = true;
  }
  for (const g of dtos) {
    if (!g.frequency || !g.frequency.toLowerCase().includes('quarter')) continue;
    const own = monthKey(g.workDate!);
    let mirrored = false;
    for (let m = quarterStart(g.workDate!), i = 0; i < 3; m = addMonths(m, 1), i++) {
      if (filter.startDate && m < filter.startDate.slice(0, 8) + '01') continue;
      if (filter.endDate && m > filter.endDate.slice(0, 8) + '01') continue;
      const k = monthKey(m);
      if (k === own) continue;
      const list = bucket(k);
      for (let j = list.length - 1; j >= 0; j--) if (list[j]!.goalId === g.goalID) list.splice(j, 1);
      list.push({ goalId: g.goalID, v: contribution(g) });
      mirrored = true;
    }
    if (mirrored && hasApproved(g)) approved = true;
  }
  const breakdown = [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, vals]) => {
    const [y, m] = k.split('-').map(Number) as [number, number];
    return { Year: y, MonthNumber: m, AvgPercent: mean2(vals.map((x) => x.v)) };
  });
  return { breakdown, approved };
}

function conds(filter: GoalDataListFilter, userID: number | null, departmentID: number | null, goalID: number | null, elID: number | null,
  from?: string | null, to?: string | null, search = false) {
  const c: string[] = [];
  const p: (string | number)[] = [];
  if (userID) { c.push('gd.UserID = ?'); p.push(userID); }
  if (departmentID) { c.push('gd.DepartmentID = ?'); p.push(departmentID); }
  if (goalID) { c.push('gd.GoalID = ?'); p.push(goalID); }
  if (elID) { c.push('d.ExecutiveLeaderID = ?'); p.push(elID); }
  if (from) { c.push('gd.WorkDate >= ?'); p.push(from); }
  if (to) { c.push('gd.WorkDate <= ?'); p.push(to); }
  if (search && filter.searchText) {
    c.push(`(u.UserName LIKE CONCAT('%', ?, '%') OR g.GoalName LIKE CONCAT('%', ?, '%'))`);
    p.push(filter.searchText, filter.searchText);
  }
  return { where: c.length ? `WHERE ${c.join(' AND ')}` : '', params: p };
}
const FROM = `FROM UserGoalData gd
  JOIN Users u ON u.UserID = gd.UserID
  JOIN DepartmentGoal g ON g.GoalID = gd.GoalID
  JOIN Department d ON d.DepartmentID = gd.DepartmentID`;

/** Java getAverageSum: the goal % for one user, department, EL, FL or the whole company, as the dashboard works it out */
async function averageSum(filter: GoalDataListFilter, userID: number | null, departmentID: number | null, elID: number | null, flID: number | null): Promise<number> {
  if (!filter.startDate || !filter.endDate) return 0;
  const roll = await computeRollup(
    { startDate: filter.startDate, endDate: filter.endDate, goalStartDate: filter.goalStartDate, goalEndDate: filter.goalEndDate }, () => '');
  if (userID) return roll.goalOf(userID, departmentID ?? 0);
  if (departmentID) {
    const users = [...(roll.usersInDept.get(departmentID) ?? [])];
    return users.length ? round2(users.reduce((n, u) => n + roll.goalOf(u, departmentID), 0) / users.length) : 0;
  }
  if (elID && elID > 0) return roll.els.find((e) => e.ELID === elID)?.AvgGoalEfficiency ?? 0;
  if (flID && flID > 0) return roll.fls.find((e) => e.FLID === flID)?.AvgGoalEfficiency ?? 0;
  return roll.company.AvgGoalEfficiency;
}

/** Java getAverageAchievedPercentageForSD / ForSDAndSDA: sum achieved / sum fixed over the filter */
async function sumOverSum(userID: number | null, departmentID: number | null, goalID: number | null, from?: string | null, to?: string | null): Promise<number> {
  const c: string[] = [];
  const p: (string | number)[] = [];
  if (userID) { c.push('ug.UserID = ?'); p.push(userID); }
  if (departmentID) { c.push('ug.DepartmentID = ?'); p.push(departmentID); }
  if (goalID) { c.push('ug.GoalID = ?'); p.push(goalID); }
  if (from) { c.push('ug.WorkDate >= ?'); p.push(from); }
  if (to) { c.push('ug.WorkDate <= ?'); p.push(to); }
  const [[r]] = await pool.query<Row[]>(
    `SELECT CASE WHEN COALESCE(SUM(ug.FixedGoal), 0) = 0 THEN 0 ELSE COALESCE(SUM(ug.AchievedGoal), 0) * 100.0 / SUM(ug.FixedGoal) END AS v
     FROM UserGoalData ug ${c.length ? `WHERE ${c.join(' AND ')}` : ''}`, p);
  return toNum(r?.['v']) ?? 0;
}

const userDepartment = async (userID: number) => {
  const [[r]] = await pool.query<Row[]>('SELECT DepartmentID FROM DepartmentUser WHERE UserID = ? LIMIT 1', [userID]);
  return r?.['DepartmentID'] != null ? Number(r['DepartmentID']) : null;
};

/**
 * POST /userGoalData/list — goal entries with achieved vs fixed goal, for Reports → Goals Achieved.
 * Ported from Java UserGoalDataService.listPaginated: newest entry first (by id, or by date with sortBy=workDate),
 * per-department efficiency, the monthly breakdown (a quarterly goal counts for its whole quarter) and the overall %.
 * Not ported: the Goal = Target users' synthetic rows (April to June) and user 155's April to June sum / sum.
 */
export async function listUserGoalData(filter: GoalDataListFilter, page?: number, size?: number, sortBy?: string) {
  const departmentID = filter.departmentID || null;
  const goalID = filter.goalID || null;
  const elID = filter.eLID || null;
  const flID = filter.fLID || null;
  // an admin or Executive Leader named as the user sees everyone once a department is chosen
  let userID = filter.userID || null;
  if (userID && departmentID) {
    const [[role]] = await pool.query<Row[]>('SELECT RoleID FROM Users WHERE UserID = ?', [userID]);
    if (role && (role['RoleID'] === 1 || role['RoleID'] === 3)) userID = null;
  }

  const paged = !!page && !!size && page > 0 && size > 0;
  const q = conds(filter, userID, departmentID, goalID, elID, filter.startDate, filter.endDate, true);
  const order = String(sortBy ?? '').toLowerCase() === 'workdate' ? 'gd.WorkDate DESC' : 'gd.UserGoalDataID DESC';
  const [rows] = await pool.query<Row[]>(
    `SELECT gd.*, u.UserName, g.GoalName, g.Frequency ${FROM} ${q.where} ORDER BY ${order}${paged ? ' LIMIT ? OFFSET ?' : ''}`,
    paged ? [...q.params, size!, (page! - 1) * size!] : q.params);
  const [[agg]] = await pool.query<Row[]>(`SELECT COUNT(*) AS n ${FROM} ${q.where}`, q.params);
  const totalRecords = Number(agg?.['n'] ?? 0);

  const cache = new Map<string, number>();
  const list = await Promise.all(rows.map((r) => mapRow(r, cache)));

  // monthly breakdown: the window is widened to whole quarters so a quarterly goal entered in a later month still counts earlier ones
  const wide = conds(filter, userID, departmentID, goalID, elID,
    filter.startDate ? quarterStart(filter.startDate) : null, filter.endDate ? quarterEnd(filter.endDate) : null);
  const [wideRows] = await pool.query<Row[]>(`SELECT gd.*, u.UserName, g.GoalName, g.Frequency ${FROM} ${wide.where}`, wide.params);
  const mres = monthly(await Promise.all(wideRows.map((r) => mapRow(r, cache))), filter);
  const avgOfMonths = () => (mres.breakdown.length ? round2(mres.breakdown.reduce((n, m) => n + m.AvgPercent, 0) / mres.breakdown.length) : 0);

  // overall %: its own rule for some departments, otherwise the dashboard's goal %
  let dept = departmentID;
  if (!dept && elID && elID > 0) {
    const [ids] = await pool.query<Row[]>('SELECT DepartmentID FROM Department WHERE ExecutiveLeaderID = ?', [elID]);
    if (ids.length === 1) dept = Number(ids[0]!['DepartmentID']);
  }
  let avgPercent = dept === 37 || dept === 21
    ? await sumOverSum(userID, dept, goalID, filter.startDate, filter.endDate)
    : await averageSum(filter, userID, departmentID, elID, flID);

  const fromMonths = userID === 129 || userID === 124 || dept === 21 || (!dept && !!userID && (await userDepartment(userID)) === 21);
  if (fromMonths || mres.approved) avgPercent = avgOfMonths();
  else if (dept === 22 && filter.startDate && filter.endDate) {
    // average over every month of the range, a month without data counting as 0
    const byKey = new Map(mres.breakdown.map((m) => [`${m.Year}-${String(m.MonthNumber).padStart(2, '0')}`, m.AvgPercent]));
    let total = 0;
    let months = 0;
    for (let m = filter.startDate.slice(0, 8) + '01'; m <= filter.endDate; m = addMonths(m, 1)) { total += byKey.get(monthKey(m)) ?? 0; months++; }
    avgPercent = months ? round2(total / months) : 0;
  }

  return {
    userGoalDataList: list.map(({ frequency: _frequency, ...d }) => d),
    totalRecords,
    totalPages: paged ? Math.ceil(totalRecords / size!) : 1,
    currentPage: paged ? page : 1,
    pageSize: paged ? size : totalRecords,
    avgPercent,
    monthlyAvgBreakdown: mres.breakdown,
  };
}

/** RevisedGoal is stored as JSON text; older rows may hold a plain number */
function parseJson(raw: unknown) {
  if (raw === null || raw === undefined || raw === '') return null;
  try { const v = JSON.parse(String(raw)); return v && typeof v === 'object' ? v : null; } catch { return null; }
}

export async function updateRevisedGoal(
  input: { UserGoalDataID: number; RevisedGoal: number; Reason?: string },
  _currentUserId?: number,
) {
  await pool.execute(
    'UPDATE UserGoalData SET RevisedGoal = ? WHERE UserGoalDataID = ?',
    [input.RevisedGoal, input.UserGoalDataID],
  );
  const [[row]] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT gd.*, g.GoalName FROM UserGoalData gd
     LEFT JOIN DepartmentGoal g ON g.GoalID = gd.GoalID
     WHERE gd.UserGoalDataID = ?`,
    [input.UserGoalDataID],
  );
  return row;
}

export async function getReviewStatus(filter: {
  UserID?: number;
  DepartmentID?: number;
  startDate?: string;
  endDate?: string;
}) {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  if (filter.UserID) { conditions.push('gd.UserID = ?'); params.push(filter.UserID); }
  if (filter.DepartmentID) { conditions.push('gd.DepartmentID = ?'); params.push(filter.DepartmentID); }
  if (filter.startDate) { conditions.push('gd.WorkDate >= ?'); params.push(filter.startDate); }
  if (filter.endDate) { conditions.push('gd.WorkDate <= ?'); params.push(filter.endDate); }

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT gd.UserID, u.UserName, u.EmployeeID,
            COUNT(*) AS totalEntries,
            SUM(CASE WHEN gd.ReviewStatus = 'APPROVED' THEN 1 ELSE 0 END) AS approved,
            SUM(CASE WHEN gd.ReviewStatus = 'PENDING' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN gd.ReviewStatus = 'REJECTED' THEN 1 ELSE 0 END) AS rejected
     FROM UserGoalData gd
     LEFT JOIN Users u ON u.UserID = gd.UserID
     WHERE ${conditions.join(' AND ')}
     GROUP BY gd.UserID, u.UserName, u.EmployeeID`,
    params,
  );
  return rows;
}

export async function getRevisedGoalById(userGoalDataID: number) {
  const [[row]] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT gd.*, g.GoalName, u.UserName
     FROM UserGoalData gd
     LEFT JOIN DepartmentGoal g ON g.GoalID = gd.GoalID
     LEFT JOIN Users u ON u.UserID = gd.UserID
     WHERE gd.UserGoalDataID = ?`,
    [userGoalDataID],
  );
  return row ?? null;
}

export async function getRevisedGoal(userId: number, goalId: number, workDate: string) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT gd.*, g.GoalName
     FROM UserGoalData gd
     LEFT JOIN DepartmentGoal g ON g.GoalID = gd.GoalID
     WHERE gd.UserID = ? AND gd.GoalID = ? AND gd.WorkDate = ?
     ORDER BY gd.UserGoalDataID DESC LIMIT 1`,
    [userId, goalId, workDate],
  );
  return rows[0] ?? null;
}
