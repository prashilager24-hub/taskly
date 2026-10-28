import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';
import { toBool, toLocalDateTime, toNum } from '../../utils/javaCompat';

export interface GoalDataListFilter {
  userID?: number | null;
  departmentID?: number | null;
  goalID?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  eLID?: number | null;
  searchText?: string | null;
}

/**
 * POST /userGoalData/list — goal entries with achieved vs fixed goal, for Reports → Goals Achieved.
 * Returns { userGoalDataList, totalRecords, …, avgPercent } as the page reads it. Efficiency is
 * achieved / fixed × 100; Java's department-specific recalculation (depts 13, 37, …) is not ported yet.
 */
export async function listUserGoalData(filter: GoalDataListFilter, page?: number, size?: number) {
  const conds: string[] = [];
  const params: (string | number)[] = [];
  if (filter.userID) { conds.push('gd.UserID = ?'); params.push(filter.userID); }
  if (filter.departmentID) { conds.push('gd.DepartmentID = ?'); params.push(filter.departmentID); }
  if (filter.goalID) { conds.push('gd.GoalID = ?'); params.push(filter.goalID); }
  if (filter.startDate) { conds.push('gd.WorkDate >= ?'); params.push(filter.startDate); }
  if (filter.endDate) { conds.push('gd.WorkDate <= ?'); params.push(filter.endDate); }
  if (filter.eLID) { conds.push('d.ExecutiveLeaderID = ?'); params.push(filter.eLID); }
  if (filter.searchText) {
    conds.push(`(u.UserName LIKE CONCAT('%', ?, '%') OR g.GoalName LIKE CONCAT('%', ?, '%'))`);
    params.push(filter.searchText, filter.searchText);
  }
  const from = `FROM UserGoalData gd
    LEFT JOIN Users u ON u.UserID = gd.UserID
    LEFT JOIN Department d ON d.DepartmentID = gd.DepartmentID
    LEFT JOIN DepartmentGoal g ON g.GoalID = gd.GoalID
    ${conds.length ? `WHERE ${conds.join(' AND ')}` : ''}`;
  const paged = !!page && !!size && page > 0 && size > 0;

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT gd.*, u.UserName, g.GoalName ${from} ORDER BY gd.WorkDate DESC, gd.UserGoalDataID DESC${paged ? ' LIMIT ? OFFSET ?' : ''}`,
    paged ? [...params, size!, (page! - 1) * size!] : params,
  );
  const [[agg]] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS n, ROUND(AVG(CASE WHEN gd.FixedGoal > 0 THEN gd.AchievedGoal / gd.FixedGoal * 100 END), 2) AS avgPercent ${from}`,
    params,
  );
  const totalRecords = Number(agg?.['n'] ?? 0);

  return {
    userGoalDataList: rows.map((r) => {
      const fixed = toNum(r['FixedGoal']) ?? 0;
      const achieved = toNum(r['AchievedGoal']) ?? 0;
      return {
        userGoalDataID: r['UserGoalDataID'],
        workDate: toLocalDateTime(r['WorkDate'])?.slice(0, 10) ?? null,
        userID: r['UserID'],
        userName: r['UserName'] ?? null,
        departmentID: r['DepartmentID'],
        goalID: r['GoalID'],
        goalName: r['GoalName'] ?? null,
        fixedGoal: fixed,
        achievedGoal: achieved,
        goalEfficiencyPercent: fixed > 0 ? Math.round((achieved / fixed) * 10000) / 100 : 0,
        recalculatedTarget: null,
        comment: r['Comment'] ?? null,
        approvedByEL: toBool(r['ApprovedByEL']),
      };
    }),
    totalRecords,
    totalPages: paged ? Math.ceil(totalRecords / size!) : 1,
    currentPage: paged ? page : 1,
    pageSize: paged ? size : totalRecords,
    avgPercent: toNum(agg?.['avgPercent']) ?? 0,
  };
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
