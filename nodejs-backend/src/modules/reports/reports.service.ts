import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';
import ExcelJS from 'exceljs';

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

// ── CombinedWork filter ───────────────────────────────────────────────────────
export interface CombinedWorkFilter {
  userID?: number;
  departmentID?: number;
  startDate?: string;
  endDate?: string;
  entryType?: 'TASK' | 'TARGET' | 'GOAL';
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
    const summary = await getUserSummary(filter);
    return { userSummary: summary };
  }

  if (isDept) {
    const [deptSummary, deptGoalSummary] = await Promise.all([
      getDepartmentSummary(filter),
      getDepartmentGoalSummary(filter),
    ]);
    return { departmentSummary: deptSummary, departmentGoalSummary: deptGoalSummary };
  }

  if (isFL && filter.isHeFunctionalLeader) {
    const [flUsers, flGoal] = await Promise.all([
      getFLSummaryUsers(filter),
      getFLGoalSummary(filter),
    ]);
    return { flUsersSummary: flUsers, flGoalSummary: flGoal };
  }

  if (isFL) {
    const flSummary = await getFLSummary(filter);
    return { flSummary };
  }

  if (isEL && filter.isHeExecutiveLeader) {
    const [elUsers, elGoal] = await Promise.all([
      getELSummaryUsers(filter),
      getELGoalSummaryAdmin(filter),
    ]);
    return { elUsersSummary: elUsers, elGoalSummary: elGoal };
  }

  if (isEL) {
    const elSummary = await getELSummary(filter);
    return { elSummary };
  }

  // Company-wide: aggregate all levels
  const [companySummary, elList, elGoalList, flList, flGoalList, deptList, deptGoalList] =
    await Promise.all([
      getCompanySummary(filter),
      getELSummary(filter),
      getELGoalSummaryAdmin(filter),
      getFLSummary(filter),
      getFLGoalSummary(filter),
      getDepartmentSummary(filter),
      getDepartmentGoalSummary(filter),
    ]);

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
    response['elSummaryAdmin'] = { eldata: await getELSummaryUsers(filter) };
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
// Combined work data: /combined/list — paginated task+target+goal entries
// ─────────────────────────────────────────────────────────────────────────────
export async function getCombinedWorkData(filter: CombinedWorkFilter, page: number, size: number) {
  const pageSize   = size > 0 && size <= 100 ? size : 10;
  const pageIndex  = Math.max(page - 1, 0);
  const offset     = pageIndex * pageSize;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filter.userID)       { conditions.push('w.UserID = ?');       params.push(filter.userID); }
  if (filter.departmentID) { conditions.push('w.DepartmentID = ?'); params.push(filter.departmentID); }
  if (filter.startDate)    { conditions.push('DATE(w.WorkDate) >= ?'); params.push(filter.startDate); }
  if (filter.endDate)      { conditions.push('DATE(w.WorkDate) <= ?'); params.push(filter.endDate); }

  // entryType filter
  if (filter.entryType === 'TASK')   { conditions.push('w.IsForTarget = 0'); }
  if (filter.entryType === 'TARGET') { conditions.push('w.IsForTarget = 1'); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total for pagination
  const countParams = [...params];
  const [[countRow]] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM UserWorkData w ${where}`, countParams,
  );
  const totalRecords = Number((countRow as mysql.RowDataPacket)['total']);
  const totalPages   = Math.ceil(totalRecords / pageSize);

  params.push(pageSize, offset);

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT w.*,
            u.UserName,
            dt.TaskName,
            d.DepartmentName
     FROM UserWorkData w
     LEFT JOIN Users u      ON u.UserID = w.UserID
     LEFT JOIN DepartmentTask dt ON dt.TaskID = w.TaskID
     LEFT JOIN Department d  ON d.DepartmentID = w.DepartmentID
     ${where}
     ORDER BY w.WorkDate DESC
     LIMIT ? OFFSET ?`,
    params,
  );

  // If also fetching goals, include them for the dates on this page
  let goalRows: mysql.RowDataPacket[] = [];
  if (filter.entryType !== 'TASK' && filter.entryType !== 'TARGET') {
    const dates = [...new Set(rows.map(r => r['WorkDate']))];
    if (dates.length) {
      const placeholders = dates.map(() => '?').join(',');
      const goalParams: (string | number)[] = [];
      const goalConds: string[] = [`DATE(g.WorkDate) IN (${placeholders})`];
      dates.forEach(d => goalParams.push(d as string));
      if (filter.userID)       { goalConds.push('g.UserID = ?');       goalParams.push(filter.userID); }
      if (filter.departmentID) { goalConds.push('g.DepartmentID = ?'); goalParams.push(filter.departmentID); }

      [goalRows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT g.*, dg.GoalName, u.UserName
         FROM UserGoalData g
         LEFT JOIN DepartmentGoal dg ON dg.GoalID = g.GoalID
         LEFT JOIN Users u ON u.UserID = g.UserID
         WHERE ${goalConds.join(' AND ')}`,
        goalParams,
      );
    }
  }

  return {
    status: true,
    statusCode: 200,
    data: rows,
    goals: goalRows,
    pagination: {
      currentPage: page,
      pageSize,
      totalPages,
      totalRecords,
    },
  };
}

export async function approveWorkEntries(input: { entryIDs: number[]; approvedBy: number }) {
  if (!input.entryIDs.length) return { message: 'No entries to approve' };
  const placeholders = input.entryIDs.map(() => '?').join(',');
  await pool.query(
    `UPDATE UserWorkData SET ApprovalStatus = 'APPROVED', ApprovedBy = ?, ApprovedAt = NOW() WHERE WorkDataID IN (${placeholders})`,
    [input.approvedBy, ...input.entryIDs],
  );
  return { status: true, message: 'Entries approved successfully' };
}

export async function rejectWorkEntry(input: { entryID: number; reason: string; rejectedBy: number }) {
  await pool.execute(
    `UPDATE UserWorkData SET ApprovalStatus = 'REJECTED', RejectionReason = ?, ApprovedBy = ?, ApprovedAt = NOW() WHERE WorkDataID = ?`,
    [input.reason, input.rejectedBy, input.entryID],
  );
  return { status: true, message: 'Entry rejected successfully' };
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
     WHERE e.DayType = 'Working' AND e.WorkDate BETWEEN ? AND ?`,
    [filter.startDate, filter.endDate],
  );
  return rows[0] ?? {};
}

async function getUserSummary(filter: DashBoardFilter) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT e.*, u.UserName, d.DepartmentName
     FROM EfficiencyUtilizationSummary e
     JOIN Users u ON u.UserID = e.UserID
     JOIN Department d ON d.DepartmentID = e.DepartmentID
     WHERE e.DayType = 'Working'
       AND e.WorkDate BETWEEN ? AND ?
       AND e.UserID = ?
     ORDER BY e.WorkDate DESC`,
    [filter.startDate, filter.endDate, filter.userID],
  );
  return rows;
}

async function getDepartmentSummary(filter: DashBoardFilter) {
  const conds = ['e.DayType = ?', 'e.WorkDate BETWEEN ? AND ?'];
  const params: (string | number)[] = ['Working', filter.startDate, filter.endDate];
  if (filter.departmentID) { conds.push('e.DepartmentID = ?'); params.push(filter.departmentID); }

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT e.DepartmentID, d.DepartmentName,
       ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
       ROUND(AVG(e.UtilizationPercent),2)    AS AvgUtilizationPercent,
       ROUND(AVG(e.TotalTimeOfWork),2)       AS AvgTotalWork,
       COUNT(DISTINCT e.UserID)              AS TotalUsers
     FROM EfficiencyUtilizationSummary e
     JOIN Department d ON d.DepartmentID = e.DepartmentID
     WHERE ${conds.join(' AND ')}
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
       ROUND(AVG(g.GoalAchievedPercent),2) AS AvgGoalEfficiency
     FROM UserGoalData g
     WHERE ${conds.join(' AND ')}
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
       COUNT(DISTINCT e.DepartmentID)        AS TotalDepts
     FROM EfficiencyUtilizationSummary e
     JOIN Department d ON d.DepartmentID = e.DepartmentID
     JOIN Users u ON u.UserID = d.ExecutiveLeaderID
     WHERE ${conds.join(' AND ')} AND d.ExecutiveLeaderID IS NOT NULL
     GROUP BY d.ExecutiveLeaderID, u.UserName`,
    params,
  );
  return rows;
}

async function getELSummaryUsers(filter: DashBoardFilter) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT e.UserID, u.UserName, e.DepartmentID, d.DepartmentName,
       ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
       ROUND(AVG(e.UtilizationPercent),2)    AS AvgUtilizationPercent
     FROM EfficiencyUtilizationSummary e
     JOIN Users u ON u.UserID = e.UserID
     JOIN Department d ON d.DepartmentID = e.DepartmentID
     WHERE e.DayType = 'Working' AND e.WorkDate BETWEEN ? AND ?
       AND d.ExecutiveLeaderID = ?
     GROUP BY e.UserID, u.UserName, e.DepartmentID, d.DepartmentName`,
    [filter.startDate, filter.endDate, filter.elID],
  );
  return rows;
}

async function getELGoalSummaryAdmin(filter: DashBoardFilter) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT d.ExecutiveLeaderID AS ELID,
       ROUND(AVG(g.GoalAchievedPercent),2) AS AvgGoalEfficiency
     FROM UserGoalData g
     JOIN Department d ON d.DepartmentID = g.DepartmentID
     WHERE g.WorkDate BETWEEN ? AND ? AND d.ExecutiveLeaderID IS NOT NULL
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
       COUNT(DISTINCT e.DepartmentID)        AS TotalDepts
     FROM EfficiencyUtilizationSummary e
     JOIN Department d ON d.DepartmentID = e.DepartmentID
     JOIN Users u ON u.UserID = d.FunctionalLeaderID
     WHERE ${conds.join(' AND ')} AND d.FunctionalLeaderID IS NOT NULL
     GROUP BY d.FunctionalLeaderID, u.UserName`,
    params,
  );
  return rows;
}

async function getFLSummaryUsers(filter: DashBoardFilter) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT e.UserID, u.UserName, e.DepartmentID, d.DepartmentName,
       ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
       ROUND(AVG(e.UtilizationPercent),2)    AS AvgUtilizationPercent
     FROM EfficiencyUtilizationSummary e
     JOIN Users u ON u.UserID = e.UserID
     JOIN Department d ON d.DepartmentID = e.DepartmentID
     WHERE e.DayType = 'Working' AND e.WorkDate BETWEEN ? AND ?
       AND d.FunctionalLeaderID = ?
     GROUP BY e.UserID, u.UserName, e.DepartmentID, d.DepartmentName`,
    [filter.startDate, filter.endDate, filter.flID],
  );
  return rows;
}

async function getFLGoalSummary(filter: DashBoardFilter) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT d.FunctionalLeaderID AS FLID,
       ROUND(AVG(g.GoalAchievedPercent),2) AS AvgGoalEfficiency
     FROM UserGoalData g
     JOIN Department d ON d.DepartmentID = g.DepartmentID
     WHERE g.WorkDate BETWEEN ? AND ? AND d.FunctionalLeaderID IS NOT NULL
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
