import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';

interface ListFilter {
  UserID?: number;
  DepartmentID?: number;
  GoalID?: number;
  startDate?: string;
  endDate?: string;
}

export async function listUserGoalData(
  filter: ListFilter,
  page?: number,
  size?: number,
  sortBy?: string,
) {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];

  if (filter.UserID) { conditions.push('gd.UserID = ?'); params.push(filter.UserID); }
  if (filter.DepartmentID) { conditions.push('gd.DepartmentID = ?'); params.push(filter.DepartmentID); }
  if (filter.GoalID) { conditions.push('gd.GoalID = ?'); params.push(filter.GoalID); }
  if (filter.startDate) { conditions.push('gd.WorkDate >= ?'); params.push(filter.startDate); }
  if (filter.endDate) { conditions.push('gd.WorkDate <= ?'); params.push(filter.endDate); }

  const orderClause = sortBy ? `ORDER BY gd.${sortBy}` : 'ORDER BY gd.WorkDate DESC';
  const where = `WHERE ${conditions.join(' AND ')}`;
  const baseQuery = `
    SELECT gd.*, u.UserName, u.EmployeeID, d.DepartmentName, g.GoalName
    FROM UserGoalData gd
    LEFT JOIN Users u ON u.UserID = gd.UserID
    LEFT JOIN Department d ON d.DepartmentID = gd.DepartmentID
    LEFT JOIN DepartmentGoal g ON g.GoalID = gd.GoalID
    ${where} ${orderClause}`;

  if (page && size) {
    const offset = (page - 1) * size;
    const [rows] = await pool.query<mysql.RowDataPacket[]>(`${baseQuery} LIMIT ? OFFSET ?`, [...params, size, offset]);
    const [[countRow]] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM UserGoalData gd ${where}`, params,
    );
    return {
      data: rows,
      total: (countRow as mysql.RowDataPacket)['total'],
      page, size,
      totalPages: Math.ceil((countRow as mysql.RowDataPacket)['total'] / size),
    };
  }

  const [rows] = await pool.query<mysql.RowDataPacket[]>(baseQuery, params);
  return { data: rows, total: rows.length };
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
