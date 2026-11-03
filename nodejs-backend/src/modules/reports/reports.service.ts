import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';
import ExcelJS from 'exceljs';
import { computeRollup, isFullDay } from './dashboardRollup';
import { computeRowAverages, dashboardUserRows } from './efficiencySummary.service';
import { calculateEfficiency, calculateTarget, calculateUtilization, round2 } from '../calculations/calculationLogic';

// ── Dashboard filter shape (mirrors Java DashBoardFilter) ─────────────────────
export interface DashBoardFilter {
  startDate: string;       // YYYY-MM-DD
  endDate: string;         // YYYY-MM-DD
  userID?: number;
  departmentID?: number;
  elID?: number;           // Executive Leader ID
  flID?: number;           // Functional Leader ID
  roleID?: number;
  isHeExecutiveLeader?: boolean;
  isHeFunctionalLeader?: boolean;
  departmentType?: string | null; // "business" | "support" | "all"
  goalStartDate?: string | null;
  goalEndDate?: string | null;
}

// Business / Support split (Java buildDepartmentFilter): keep only departments whose
// PrimaryDepartment.Type matches. Whitelisted, so the literal below is safe to inline.
function deptTypeCond(filter: DashBoardFilter, col: string): string {
  const type = String(filter.departmentType ?? '').toLowerCase();
  if (type !== 'business' && type !== 'support') return '';
  return ` AND ${col} IN (SELECT d2.DepartmentID FROM Department d2 JOIN PrimaryDepartment pd ON d2.PrimaryDepartmentId = pd.PrimaryDepartmentId WHERE pd.Type = '${type.toUpperCase()}')`;
}

// ── EfficiencySummaryFilter (mirrors Java EfficiencySummaryFilterRequest) ─────
export interface EfficiencySummaryFilter {
  startDate: string;
  endDate: string;
  userID?: number;
  departmentID?: number;
  elID?: number;
  isHeExecutiveLeader?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard: /DashBoard  — flat efficiency summary by user/dept/company
// ─────────────────────────────────────────────────────────────────────────────
export async function listEfficiencySummary(filter: DashBoardFilter) {
  const conditions: string[] = ['e.DayType = ?', 'e.WorkDate BETWEEN ? AND ?'];
  const params: (string | number | boolean)[] = ['Working', filter.startDate, filter.endDate];

  const isUser = !!filter.userID;
  const isDept = !!filter.departmentID;
  const isEL   = !!filter.elID;

  let selectExtra: string;
  let groupBy: string;

  if (isUser) {
    selectExtra = ', e.UserID, u.UserName';
    groupBy = 'GROUP BY e.UserID, u.UserName';
    conditions.push('e.UserID = ?');
    params.push(filter.userID!);
  } else if (isDept) {
    selectExtra = ', e.DepartmentID, d.DepartmentName';
    groupBy = 'GROUP BY e.DepartmentID, d.DepartmentName';
    conditions.push('e.DepartmentID = ?');
    params.push(filter.departmentID!);
  } else if (isEL) {
    selectExtra = ', e.DepartmentID, d.DepartmentName';
    groupBy = 'GROUP BY e.DepartmentID, d.DepartmentName';
    conditions.push(`e.DepartmentID IN (SELECT DepartmentID FROM Department WHERE ExecutiveLeaderID = ?)`);
    params.push(filter.elID!);
  } else {
    selectExtra = ", 'COMPANY' AS Level";
    groupBy = '';
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT
       ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
       ROUND(AVG(e.UtilizationPercent),2)    AS AvgUtilizationPercent,
       ROUND(AVG(e.AllocatedTimeHrs),2)      AS AvgAllocatedHrs,
       ROUND(AVG(e.TotalTimeOfWork),2)       AS AvgTotalWork,
       CASE
         WHEN ROUND(AVG(e.TargetAchievedPercent),2) >= 100
              AND ROUND(AVG(e.UtilizationPercent),2) >= 80
              AND ROUND(AVG(e.TotalTimeOfWork),2) <= ROUND(AVG(e.AllocatedTimeHrs),2)
         THEN 'High'
         WHEN ROUND(AVG(e.TargetAchievedPercent),2) >= 80
              AND ROUND(AVG(e.UtilizationPercent),2) >= 50
              AND ROUND(AVG(e.TotalTimeOfWork),2) <= ROUND(AVG(e.AllocatedTimeHrs),2)
         THEN 'At Par'
         ELSE 'Low'
       END AS EfficiencyLevel
       ${selectExtra}
     FROM EfficiencyUtilizationSummary e
     JOIN Users u ON e.UserID = u.UserID
     JOIN Department d ON e.DepartmentID = d.DepartmentID
     ${where}
     ${groupBy}`,
    params,
  );
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard: /DashBoardAll — rich multi-level summary (company→EL→FL→dept→user)
// Mirrors Java listEfficiencySummaryNewData routing logic
// ─────────────────────────────────────────────────────────────────────────────
export async function listEfficiencySummaryNewData(filter: DashBoardFilter) {
  const isUser = !!filter.userID;
  const isDept = !!filter.departmentID;
  const isEL   = !!filter.elID;
  const isFL   = !!filter.flID;

  if (isUser) {
    // a person's own dashboard (role 2) also carries the day-by-day rows for the calendar
    return { userSummary: await getUserSummaries(filter, filter.roleID === 2) };
  }

  if (isDept) {
    const [deptSummary, deptGoalSummary] = await Promise.all([
      getDepartmentSummary(filter),
      getDepartmentGoalSummary(filter),
    ]);
    return { departmentSummary: deptSummary, departmentGoalSummary: deptGoalSummary };
  }

  // A leader's own team: leader -> departments -> users, rolled up the same way as the company view
  if (isFL && filter.isHeFunctionalLeader) {
    const { fls } = await computeRollup(filter, (col) => deptTypeCond(filter, col));
    const mine = fls.filter((fl) => fl.FLID === filter.flID);
    return { flUsersSummary: mine, flGoalSummary: mine.map((fl) => ({ FLID: fl.FLID, AvgGoalEfficiency: fl.AvgGoalEfficiency })) };
  }

  if (isFL) {
    const flSummary = await getFLSummary(filter);
    return { flSummary };
  }

  if (isEL && filter.isHeExecutiveLeader) {
    const { els } = await computeRollup(filter, (col) => deptTypeCond(filter, col));
    const mine = els.filter((el) => el.ELID === filter.elID);
    return { elUsersSummary: mine, elGoalSummary: mine.map((el) => ({ ELID: el.ELID, AvgGoalEfficiency: el.AvgGoalEfficiency })) };
  }

  if (isEL) {
    const elSummary = await getELSummary(filter);
    return { elSummary };
  }

  // Company-wide: aggregate all levels
  const [companyCounts, rollup, elList, elGoalList, flList, flGoalList, deptList, deptGoalList] =
    await Promise.all([
      getCompanySummary(filter),
      computeRollup(filter, (col) => deptTypeCond(filter, col)),
      getELSummary(filter),
      getELGoalSummaryAdmin(filter),
      getFLSummary(filter),
      getFLGoalSummary(filter),
      getDepartmentSummary(filter),
      getDepartmentGoalSummary(filter),
    ]);

  // Averages come from the user -> department -> EL roll-up (Java getCompanySummary); the flat
  // query only supplies the headcounts.
  const companySummary = { ...companyCounts, ...rollup.company };

  // Merge goal efficiency into EL list
  const elGoalMap = new Map(elGoalList.map((r: mysql.RowDataPacket) => [r['ELID'], r['AvgGoalEfficiency'] ?? 0]));
  for (const el of elList) { (el as mysql.RowDataPacket)['AvgGoalEfficiency'] = elGoalMap.get((el as mysql.RowDataPacket)['ELID']) ?? 0; }

  // Merge goal efficiency into FL list
  const flGoalMap = new Map(flGoalList.map((r: mysql.RowDataPacket) => [r['FLID'], r['AvgGoalEfficiency'] ?? 0]));
  for (const fl of flList) { (fl as mysql.RowDataPacket)['AvgGoalEfficiency'] = flGoalMap.get((fl as mysql.RowDataPacket)['FLID']) ?? 0; }

  // Merge goal efficiency into dept list
  const deptGoalMap = new Map(deptGoalList.map((r: mysql.RowDataPacket) => [r['DepartmentID'], r['AvgGoalEfficiency'] ?? 0]));
  for (const dept of deptList) { (dept as mysql.RowDataPacket)['AvgGoalEfficiency'] = deptGoalMap.get((dept as mysql.RowDataPacket)['DepartmentID']) ?? 0; }

  const response: Record<string, unknown> = {
    companySummary,
    elSummary: elList,
    flSummary: flList,
    departmentSummary: deptList,
  };

  if (filter.roleID === 1) {
    response['elSummaryAdmin'] = { eldata: rollup.els };
  }

  return response;
}

// ─────────────────────────────────────────────────────────────────────────────
// Efficiency Report: /list-efficiency-summary (with EL-wide vs specific dept)
// ─────────────────────────────────────────────────────────────────────────────
export async function listEfficiencyReport(filter: EfficiencySummaryFilter) {
  const isEL    = filter.isHeExecutiveLeader === true;
  const hasDept = !!filter.departmentID;

  if (isEL && !hasDept) {
    return listEfficiencySummaryEl(filter);
  }
  return listEfficiencySummaryNormal(filter);
}

async function listEfficiencySummaryNormal(filter: EfficiencySummaryFilter) {
  const conditions: string[] = ['e.DayType = ?', 'e.WorkDate BETWEEN ? AND ?'];
  const params: (string | number)[] = ['Working', filter.startDate, filter.endDate];

  if (filter.userID) { conditions.push('e.UserID = ?'); params.push(filter.userID); }
  if (filter.departmentID) { conditions.push('e.DepartmentID = ?'); params.push(filter.departmentID); }
  if (filter.elID && !filter.userID) {
    conditions.push(`e.DepartmentID IN (SELECT DepartmentID FROM Department WHERE ExecutiveLeaderID = ?)`);
    params.push(filter.elID);
  }

  const groupBy = filter.userID
    ? 'GROUP BY e.UserID, u.UserName'
    : 'GROUP BY e.DepartmentID, d.DepartmentName';

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT
       e.UserID, u.UserName,
       e.DepartmentID, d.DepartmentName,
       ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
       ROUND(AVG(e.UtilizationPercent),2)    AS AvgUtilizationPercent,
       ROUND(AVG(e.AllocatedTimeHrs),2)      AS AvgAllocatedHrs,
       ROUND(AVG(e.TotalTimeOfWork),2)       AS AvgTotalWork,
       e.EfficiencyLevel
     FROM EfficiencyUtilizationSummary e
     JOIN Users u ON e.UserID = u.UserID
     JOIN Department d ON e.DepartmentID = d.DepartmentID
     WHERE ${conditions.join(' AND ')}
     ${groupBy}`,
    params,
  );
  return rows;
}

async function listEfficiencySummaryEl(filter: EfficiencySummaryFilter) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT
       e.DepartmentID, d.DepartmentName,
       ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
       ROUND(AVG(e.UtilizationPercent),2)    AS AvgUtilizationPercent,
       ROUND(AVG(e.TotalTimeOfWork),2)       AS AvgTotalWork,
       ROUND(AVG(e.AllocatedTimeHrs),2)      AS AvgAllocatedHrs,
       e.EfficiencyLevel
     FROM EfficiencyUtilizationSummary e
     JOIN Department d ON e.DepartmentID = d.DepartmentID
     WHERE e.DayType = 'Working'
       AND e.WorkDate BETWEEN ? AND ?
       AND d.ExecutiveLeaderID = ?
     GROUP BY e.DepartmentID, d.DepartmentName`,
    [filter.startDate, filter.endDate, filter.elID],
  );
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Private summary helpers (mirrors Java private methods in DashBoardService)
// ─────────────────────────────────────────────────────────────────────────────
async function getCompanySummary(filter: DashBoardFilter) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT
       ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
       ROUND(AVG(e.UtilizationPercent),2)    AS AvgUtilizationPercent,
       ROUND(AVG(e.AllocatedTimeHrs),2)      AS AvgAllocatedHrs,
       ROUND(AVG(e.TotalTimeOfWork),2)       AS AvgTotalWork,
       COUNT(DISTINCT e.UserID)              AS TotalUsers,
       COUNT(DISTINCT e.DepartmentID)        AS TotalDepartments
     FROM EfficiencyUtilizationSummary e
     WHERE e.DayType = 'Working' AND e.WorkDate BETWEEN ? AND ?${deptTypeCond(filter, 'e.DepartmentID')}`,
    [filter.startDate, filter.endDate],
  );
  return rows[0] ?? {};
}

// One person (or the people in the filter) for the range: the averages the dashboard cards show.
// Java DashBoardService.getUserSummary / getUserSummaryForUsers: each department a person worked in is summarised on
// its own (full-day leave days dropped, a target counted only on days that have one), then the departments are averaged.
// A person's own dashboard (withDailyData) also gets their day rows, again without the leave days.
async function getUserSummaries(filter: DashBoardFilter, withDailyData: boolean) {
  let rows = await dashboardUserRows({ startDate: filter.startDate, endDate: filter.endDate, userID: filter.userID, departmentID: filter.departmentID, elID: filter.elID });
  if (!withDailyData && deptTypeCond(filter, 'd.DepartmentID')) {
    const [allowed] = await pool.query<mysql.RowDataPacket[]>(`SELECT d.DepartmentID FROM Department d WHERE 1=1${deptTypeCond(filter, 'd.DepartmentID')}`);
    const ids = new Set(allowed.map((d) => d['DepartmentID']));
    rows = rows.filter((r) => ids.has(r['DepartmentID']));
  }

  const users = new Map<number, { name: string; depts: Map<number, Record<string, any>[]> }>();
  for (const r of rows) {
    const u = users.get(r['UserID']) ?? users.set(r['UserID'], { name: r['UserName'], depts: new Map() }).get(r['UserID'])!;
    (u.depts.get(r['DepartmentID']) ?? u.depts.set(r['DepartmentID'], []).get(r['DepartmentID'])!).push(r);
  }

  const mean = (values: unknown[]) => (values.length ? round2(values.reduce<number>((n, v) => n + (Number(v) || 0), 0) / values.length) : 0);
  const result: Record<string, any>[] = [];
  for (const [userID, u] of users) {
    const perDept = [...u.depts.values()].map((deptRows) => {
      const kept = deptRows.filter((r) => !isFullDay(r['LeaveType']));
      if (!kept.length) return { AvgTargetPercent: 0, AvgUtilizationPercent: 0, AvgAllocatedHrs: 0, AvgTotalWork: 0, EfficiencyLevel: 'Low' };
      const a = computeRowAverages(kept);
      return { AvgTargetPercent: a.AvgTargetPercent, AvgUtilizationPercent: a.AvgUtilizationPercent, AvgAllocatedHrs: a.AvgAllocatedHrs, AvgTotalWork: a.AvgTotalWork, EfficiencyLevel: a.EfficiencyLevel };
    });
    const summary = perDept.length === 1 ? perDept[0]! : {
      AvgTargetPercent: calculateTarget({ kind: 'userAverage', values: perDept.map((d) => d.AvgTargetPercent) }),
      AvgUtilizationPercent: calculateUtilization({ kind: 'average', values: perDept.map((d) => d.AvgUtilizationPercent) }),
      AvgAllocatedHrs: mean(perDept.map((d) => d.AvgAllocatedHrs)),
      AvgTotalWork: mean(perDept.map((d) => d.AvgTotalWork)),
      EfficiencyLevel: calculateEfficiency({ kind: 'scoreLevel', score: perDept.reduce((n, d) => n + calculateEfficiency({ kind: 'levelScore', level: d.EfficiencyLevel }), 0) / perDept.length }),
    };
    const user: Record<string, any> = { UserID: userID, UserName: u.name, ...summary };

    if (withDailyData) {
      const [daily] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT DATE_FORMAT(e.WorkDate, '%Y-%m-%d') AS WorkDate, e.TargetAchievedPercent, e.UtilizationPercent, e.AllocatedTimeHrs, e.TotalTimeOfWork, e.EfficiencyLevel
         FROM EfficiencyUtilizationSummary e
         WHERE e.DayType = 'Working' AND e.UserID = ? AND e.WorkDate BETWEEN ? AND ?
           AND NOT EXISTS (SELECT 1 FROM UserWorkData uw WHERE uw.UserID = e.UserID AND uw.WorkDate = e.WorkDate AND UPPER(TRIM(uw.LeaveType)) = 'FULL_DAY')
         ORDER BY e.WorkDate ASC`,
        [userID, filter.startDate, filter.endDate]);
      user['DailyData'] = daily.map((d) => ({
        WorkDate: d['WorkDate'], TargetAchievedPercent: Number(d['TargetAchievedPercent']), UtilizationPercent: Number(d['UtilizationPercent']),
        AllocatedTimeHrs: Number(d['AllocatedTimeHrs']), TotalTimeOfWork: Number(d['TotalTimeOfWork']), EfficiencyLevel: d['EfficiencyLevel'], UserID: userID,
      }));
    }
    result.push(user);
  }
  return result.sort((x, y) => (x['UserName'] < y['UserName'] ? -1 : x['UserName'] > y['UserName'] ? 1 : 0));
}

async function getDepartmentSummary(filter: DashBoardFilter) {
  const conds = ['e.DayType = ?', 'e.WorkDate BETWEEN ? AND ?'];
  const params: (string | number)[] = ['Working', filter.startDate, filter.endDate];
  if (filter.departmentID) { conds.push('e.DepartmentID = ?'); params.push(filter.departmentID); }

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT e.DepartmentID, d.DepartmentName,
       ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
       ROUND(AVG(e.UtilizationPercent),2)    AS AvgUtilizationPercent,
       ROUND(AVG(e.AllocatedTimeHrs),2)      AS AvgAllocatedHrs,
       ROUND(AVG(e.TotalTimeOfWork),2)       AS AvgTotalWork,
       CASE
         WHEN ROUND(AVG(e.TargetAchievedPercent),2) >= 100 AND ROUND(AVG(e.UtilizationPercent),2) >= 80
              AND ROUND(AVG(e.TotalTimeOfWork),2) <= ROUND(AVG(e.AllocatedTimeHrs),2) THEN 'High'
         WHEN ROUND(AVG(e.TargetAchievedPercent),2) >= 80 AND ROUND(AVG(e.UtilizationPercent),2) >= 50
              AND ROUND(AVG(e.TotalTimeOfWork),2) <= ROUND(AVG(e.AllocatedTimeHrs),2) THEN 'At Par'
         ELSE 'Low'
       END AS EfficiencyLevel,
       COUNT(DISTINCT e.UserID)              AS TotalUsers
     FROM EfficiencyUtilizationSummary e
     JOIN Department d ON d.DepartmentID = e.DepartmentID
     WHERE ${conds.join(' AND ')}${deptTypeCond(filter, 'e.DepartmentID')}
     GROUP BY e.DepartmentID, d.DepartmentName`,
    params,
  );
  return rows;
}

async function getDepartmentGoalSummary(filter: DashBoardFilter) {
  const conds: string[] = ['g.WorkDate BETWEEN ? AND ?'];
  const params: (string | number)[] = [filter.startDate, filter.endDate];
  if (filter.departmentID) { conds.push('g.DepartmentID = ?'); params.push(filter.departmentID); }

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT g.DepartmentID,
       ROUND(AVG(CASE WHEN g.FixedGoal > 0 THEN g.AchievedGoal / g.FixedGoal * 100 END),2) AS AvgGoalEfficiency
     FROM UserGoalData g
     WHERE ${conds.join(' AND ')}${deptTypeCond(filter, 'g.DepartmentID')}
     GROUP BY g.DepartmentID`,
    params,
  );
  return rows;
}

async function getELSummary(filter: DashBoardFilter) {
  const conds = ['e.DayType = ?', 'e.WorkDate BETWEEN ? AND ?'];
  const params: (string | number)[] = ['Working', filter.startDate, filter.endDate];
  if (filter.elID) { conds.push('d.ExecutiveLeaderID = ?'); params.push(filter.elID); }

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT d.ExecutiveLeaderID AS ELID, u.UserName AS ELName,
       ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
       ROUND(AVG(e.UtilizationPercent),2)    AS AvgUtilizationPercent,
       ROUND(AVG(e.AllocatedTimeHrs),2)      AS AvgAllocatedHrs,
       ROUND(AVG(e.TotalTimeOfWork),2)       AS AvgTotalWork,
       CASE
         WHEN ROUND(AVG(e.TargetAchievedPercent),2) >= 100 AND ROUND(AVG(e.UtilizationPercent),2) >= 80
              AND ROUND(AVG(e.TotalTimeOfWork),2) <= ROUND(AVG(e.AllocatedTimeHrs),2) THEN 'High'
         WHEN ROUND(AVG(e.TargetAchievedPercent),2) >= 80 AND ROUND(AVG(e.UtilizationPercent),2) >= 50
              AND ROUND(AVG(e.TotalTimeOfWork),2) <= ROUND(AVG(e.AllocatedTimeHrs),2) THEN 'At Par'
         ELSE 'Low'
       END AS EfficiencyLevel,
       COUNT(DISTINCT e.DepartmentID)        AS TotalDepts
     FROM EfficiencyUtilizationSummary e
     JOIN Department d ON d.DepartmentID = e.DepartmentID
     JOIN Users u ON u.UserID = d.ExecutiveLeaderID
     WHERE ${conds.join(' AND ')} AND u.RoleID = 3 AND d.ExecutiveLeaderID IS NOT NULL${deptTypeCond(filter, 'd.DepartmentID')}
     GROUP BY d.ExecutiveLeaderID, u.UserName`,
    params,
  );
  return rows;
}

async function getELGoalSummaryAdmin(filter: DashBoardFilter) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT d.ExecutiveLeaderID AS ELID,
       ROUND(AVG(CASE WHEN g.FixedGoal > 0 THEN g.AchievedGoal / g.FixedGoal * 100 END),2) AS AvgGoalEfficiency
     FROM UserGoalData g
     JOIN Department d ON d.DepartmentID = g.DepartmentID
     WHERE g.WorkDate BETWEEN ? AND ? AND d.ExecutiveLeaderID IS NOT NULL${deptTypeCond(filter, 'd.DepartmentID')}
     GROUP BY d.ExecutiveLeaderID`,
    [filter.startDate, filter.endDate],
  );
  return rows;
}

async function getFLSummary(filter: DashBoardFilter) {
  const conds = ['e.DayType = ?', 'e.WorkDate BETWEEN ? AND ?'];
  const params: (string | number)[] = ['Working', filter.startDate, filter.endDate];
  if (filter.flID) { conds.push('d.FunctionalLeaderID = ?'); params.push(filter.flID); }

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT d.FunctionalLeaderID AS FLID, u.UserName AS FLName,
       ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
       ROUND(AVG(e.UtilizationPercent),2)    AS AvgUtilizationPercent,
       ROUND(AVG(e.AllocatedTimeHrs),2)      AS AvgAllocatedHrs,
       ROUND(AVG(e.TotalTimeOfWork),2)       AS AvgTotalWork,
       CASE
         WHEN ROUND(AVG(e.TargetAchievedPercent),2) >= 100 AND ROUND(AVG(e.UtilizationPercent),2) >= 80
              AND ROUND(AVG(e.TotalTimeOfWork),2) <= ROUND(AVG(e.AllocatedTimeHrs),2) THEN 'High'
         WHEN ROUND(AVG(e.TargetAchievedPercent),2) >= 80 AND ROUND(AVG(e.UtilizationPercent),2) >= 50
              AND ROUND(AVG(e.TotalTimeOfWork),2) <= ROUND(AVG(e.AllocatedTimeHrs),2) THEN 'At Par'
         ELSE 'Low'
       END AS EfficiencyLevel,
       COUNT(DISTINCT e.DepartmentID)        AS TotalDepts
     FROM EfficiencyUtilizationSummary e
     JOIN Department d ON d.DepartmentID = e.DepartmentID
     JOIN Users u ON u.UserID = d.FunctionalLeaderID
     WHERE ${conds.join(' AND ')} AND u.RoleID = 4 AND d.FunctionalLeaderID IS NOT NULL${deptTypeCond(filter, 'd.DepartmentID')}
     GROUP BY d.FunctionalLeaderID, u.UserName`,
    params,
  );
  return rows;
}

async function getFLGoalSummary(filter: DashBoardFilter) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT d.FunctionalLeaderID AS FLID,
       ROUND(AVG(CASE WHEN g.FixedGoal > 0 THEN g.AchievedGoal / g.FixedGoal * 100 END),2) AS AvgGoalEfficiency
     FROM UserGoalData g
     JOIN Department d ON d.DepartmentID = g.DepartmentID
     WHERE g.WorkDate BETWEEN ? AND ? AND d.FunctionalLeaderID IS NOT NULL${deptTypeCond(filter, 'd.DepartmentID')}
     GROUP BY d.FunctionalLeaderID`,
    [filter.startDate, filter.endDate],
  );
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel download: /download-efficiency-summary
// Port of Java EfficiencyReportService.downloadEfficiencySummaryExcel()
// ─────────────────────────────────────────────────────────────────────────────
export async function downloadEfficiencySummary(filter: EfficiencySummaryFilter): Promise<Buffer> {
  // Re-use the same query as listEfficiencyReport so data is identical
  const rows = await listEfficiencyReport(filter);

  const workbook  = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Efficiency Summary');

  worksheet.columns = [
    { header: 'Department',          key: 'DepartmentName',           width: 25 },
    { header: 'User',                key: 'UserName',                 width: 25 },
    { header: 'Avg Target %',        key: 'AvgTargetPercent',         width: 15 },
    { header: 'Avg Utilization %',   key: 'AvgUtilizationPercent',    width: 18 },
    { header: 'Avg Allocated Hrs',   key: 'AvgAllocatedHrs',          width: 18 },
    { header: 'Avg Total Work',      key: 'AvgTotalWork',             width: 16 },
    { header: 'Efficiency Level',    key: 'EfficiencyLevel',          width: 18 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  for (const row of rows as Record<string, unknown>[]) {
    worksheet.addRow(row);
  }

  // Auto-fit row height for data rows
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > 1) row.height = 20;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
