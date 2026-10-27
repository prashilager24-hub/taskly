import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';

export async function getTargetsByDepartment(departmentId: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT dt.*, GROUP_CONCAT(dtr.RoleID) AS AllowedRoles
     FROM DepartmentTarget dt
     LEFT JOIN DepartmentTargetRole dtr ON dtr.TargetID = dt.TargetID
     WHERE dt.DepartmentID = ?
     GROUP BY dt.TargetID
     ORDER BY dt.TargetName`,
    [departmentId],
  );
  return rows;
}

export async function createTarget(input: {
  DepartmentID: number; TargetName: string; TargetMetric: string; Frequency: string;
}) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    'INSERT INTO DepartmentTarget (DepartmentID, TargetName, TargetMetric, Frequency) VALUES (?, ?, ?, ?)',
    [input.DepartmentID, input.TargetName, input.TargetMetric, input.Frequency],
  );
  return { TargetID: r.insertId, message: 'Target created' };
}

export async function getMonthlyTargets(departmentId: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT * FROM MonthlyDepartmentTargets WHERE DepartmentID = ? ORDER BY DayOfMonth',
    [departmentId],
  );
  return rows;
}

export async function createMonthlyTarget(input: {
  TargetName: string; DayOfMonth: number; DepartmentID: number;
}) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    'INSERT INTO MonthlyDepartmentTargets (TargetName, DayOfMonth, DepartmentID) VALUES (?, ?, ?)',
    [input.TargetName, input.DayOfMonth, input.DepartmentID],
  );
  return { TargetID: r.insertId, message: 'Monthly target created' };
}

export async function getEfficiencySummary(filters: {
  UserID?: number; DepartmentID?: number;
  fromDate: string; toDate: string; WorkType?: string;
}) {
  const conditions = ['eus.WorkDate BETWEEN ? AND ?'];
  const params: (string | number)[] = [filters.fromDate, filters.toDate];

  if (filters.UserID) { conditions.push('eus.UserID = ?'); params.push(filters.UserID); }
  if (filters.DepartmentID) { conditions.push('eus.DepartmentID = ?'); params.push(filters.DepartmentID); }
  if (filters.WorkType) { conditions.push('eus.WorkType = ?'); params.push(filters.WorkType); }

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT eus.*, u.UserName, u.EmployeeID, d.DepartmentName
     FROM EfficiencyUtilizationSummary eus
     JOIN Users u ON u.UserID = eus.UserID
     JOIN Department d ON d.DepartmentID = eus.DepartmentID
     WHERE ${conditions.join(' AND ')}
     ORDER BY eus.WorkDate DESC`,
    params,
  );
  return rows;
}
