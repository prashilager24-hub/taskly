import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { toLocalDateTime, toNum } from '../../utils/javaCompat';

// POST /list-efficiency-summary — Reports → Performance Insights, User History, Query Report.
// Core of Java EfficiencyReportService.listEfficiencySummary / listEfficiencySummaryEl: the same
// rows (day / week / month) and filters, with the summary as plain averages. Not ported yet:
// Java's post-query adjustments (leave type, revised targets, depts 19/23 target maths) and the
// department → EL → company averaging hierarchy.

export interface EfficiencySummaryRequest {
  startDate?: string | null;
  endDate?: string | null;
  userID?: number | null;
  departmentID?: number | null;
  eLID?: number | null;
  groupBy?: string | null;
  efficiencyLevel?: string | null;
  isHeExecutiveLeader?: boolean | null;
  filters?: { field: string; operator: string; value: string }[] | null;
}

// Java pasted the operator from the request into SQL; only these are accepted here
const OPERATORS = new Set(['=', '>', '<', '>=', '<=', '!=']);
const FILTER_COLUMNS: Record<string, string> = { Name: 'u.UserName', Department: 'd.DepartmentName' };

const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Java's efficiency rules: High ≥ 100% target and ≥ 80% goal; At Par ≥ 80% / ≥ 50%; else Low */
function level(target: number, goal: number, worked: number, allocated: number) {
  if (target >= 100 && goal >= 80 && worked <= allocated) return 'High';
  if (target >= 80 && goal >= 50 && worked <= allocated) return 'At Par';
  return 'Low';
}

async function goalPercentByUserDay(start?: string | null, end?: string | null) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT UserID, DATE_FORMAT(WorkDate, '%Y-%m-%d') AS d,
            AVG(CASE WHEN FixedGoal > 0 THEN AchievedGoal / FixedGoal * 100 END) AS pct
     FROM UserGoalData WHERE (? IS NULL OR WorkDate >= ?) AND (? IS NULL OR WorkDate <= ?)
     GROUP BY UserID, WorkDate`,
    [start ?? null, start ?? null, end ?? null, end ?? null],
  );
  return new Map(rows.map((r) => [`${r['UserID']}|${r['d']}`, toNum(r['pct']) ?? 0]));
}

async function rows(f: EfficiencySummaryRequest, elId: number | null) {
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

  const select = groupBy === 'week' || groupBy === 'month'
    ? `YEAR(e.WorkDate) AS Year, ${groupBy === 'week' ? 'WEEK(e.WorkDate, 1) AS WeekNumber' : 'MONTH(e.WorkDate) AS MonthNumber'},
       ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent, ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
       ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs, ROUND(AVG(e.TotalTimeOfWork),2) AS TotalTimeOfWork,
       MAX(e.EfficiencyLevel) AS EfficiencyLevel`
    : 'e.WorkDate, e.TargetAchievedPercent, e.UtilizationPercent, e.AllocatedTimeHrs, e.TotalTimeOfWork, e.EfficiencyLevel, e.DayType';
  const group = groupBy === 'week' || groupBy === 'month'
    ? `GROUP BY e.UserID, u.UserName, e.DepartmentID, d.DepartmentName, YEAR(e.WorkDate), ${groupBy === 'week' ? 'WEEK(e.WorkDate, 1)' : 'MONTH(e.WorkDate)'}`
    : 'ORDER BY e.WorkDate ASC';

  const [result] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT e.UserID, u.UserName, e.DepartmentID, d.DepartmentName, ${select}
     FROM EfficiencyUtilizationSummary e
     JOIN Users u ON e.UserID = u.UserID
     JOIN Department d ON e.DepartmentID = d.DepartmentID
     WHERE ${conds.join(' AND ')} ${group}`,
    params,
  );

  const goals = await goalPercentByUserDay(f.startDate, f.endDate);
  return result
    // Full-day leave days are left out, as in Java
    .filter((r) => r['DayType'] !== 'Leave')
    .map((r): Record<string, unknown> => {
      const date = r['WorkDate'] ? toLocalDateTime(r['WorkDate'])!.slice(0, 10) : undefined;
      const { DayType: _omit, ...rest } = r;
      return {
        ...rest,
        ...(date ? { WorkDate: date } : {
          AvgTargetPercent: toNum(r['AvgTargetPercent']),
          AvgUtilizationPercent: toNum(r['AvgUtilizationPercent']),
          AvgAllocatedHrs: toNum(r['AvgAllocatedHrs']),
        }),
        TargetAchievedPercent: toNum(r['TargetAchievedPercent'] ?? r['AvgTargetPercent']),
        UtilizationPercent: toNum(r['UtilizationPercent'] ?? r['AvgUtilizationPercent']),
        AllocatedTimeHrs: toNum(r['AllocatedTimeHrs'] ?? r['AvgAllocatedHrs']),
        TotalTimeOfWork: toNum(r['TotalTimeOfWork']),
        GoalPercent: date ? round2(goals.get(`${r['UserID']}|${date}`) ?? 0) : 0,
        LeaveType: 'NONE',
      };
    });
}

function summarize(list: Record<string, unknown>[]) {
  const n = (k: string) => mean(list.map((r) => Number(r[k] ?? 0)));
  const target = round2(n('TargetAchievedPercent'));
  const util = round2(n('UtilizationPercent'));
  const allocated = round2(n('AllocatedTimeHrs'));
  const worked = round2(n('TotalTimeOfWork'));
  const goal = round2(n('GoalPercent'));
  return {
    AvgTargetPercent: target,
    AvgUtilizationPercent: util,
    AvgAllocatedHrs: allocated,
    AvgTotalWork: worked,
    AvgGoalPercent: goal,
    EfficiencyLevel: list.length ? level(target, goal, worked, allocated) : null,
  };
}

export async function listEfficiencySummary(f: EfficiencySummaryRequest) {
  const elWithoutDept = f.isHeExecutiveLeader === true && !f.departmentID;

  if (!elWithoutDept) {
    const data = await rows(f, f.eLID ?? null);
    return { data, summary: summarize(data) };
  }

  // Executive Leader with no department picked: every department they lead, with its users' averages
  const [depts] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT DepartmentID, DepartmentName, ExecutiveLeaderID FROM Department WHERE ExecutiveLeaderID = ? AND IsDepartmentArchived = 0',
    [f.eLID ?? f.userID ?? 0],
  );
  const departments = [];
  for (const dept of depts) {
    const data = await rows({ ...f, departmentID: dept['DepartmentID'] as number, userID: null }, null);
    const byUser = new Map<number, Record<string, unknown>[]>();
    for (const r of data) {
      const list = byUser.get(r['UserID'] as number) ?? [];
      list.push(r);
      byUser.set(r['UserID'] as number, list);
    }
    departments.push({
      DepartmentID: dept['DepartmentID'],
      DepartmentName: dept['DepartmentName'],
      ELID: dept['ExecutiveLeaderID'],
      Users: [...byUser.values()].map((list) => ({ UserID: list[0]!['UserID'], UserName: list[0]!['UserName'], ...summarize(list) })),
      summary: summarize(data),
    });
  }
  return { status: true, message: 'Efficiency summary by department', departments };
}
