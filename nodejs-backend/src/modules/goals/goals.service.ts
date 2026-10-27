import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';

export async function getGoalsByDepartment(departmentId: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT GoalID, DepartmentID, GoalName, GoalMetric, Frequency, IsDynamic, approvedByEL
     FROM DepartmentGoal WHERE DepartmentID = ? ORDER BY GoalName`,
    [departmentId],
  );
  return rows;
}

export async function createGoal(input: {
  DepartmentID: number; GoalName: string; GoalMetric: string;
  Frequency: string; IsDynamic?: boolean; approvedByEL?: boolean;
}) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO DepartmentGoal (DepartmentID, GoalName, GoalMetric, Frequency, IsDynamic, approvedByEL)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.DepartmentID, input.GoalName, input.GoalMetric, input.Frequency,
     input.IsDynamic ? 1 : 0, input.approvedByEL ? 1 : 0],
  );
  return { GoalID: r.insertId, message: 'Goal created' };
}

export async function logGoalData(input: {
  WorkDate: string; UserID: number; DepartmentID: number; GoalID: number;
  FixedGoal: number; AchievedGoal: number; metadata?: object; RevisedGoal?: number;
}) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO UserGoalData
       (WorkDate, UserID, DepartmentID, GoalID, FixedGoal, AchievedGoal, metadata, RevisedGoal)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.WorkDate, input.UserID, input.DepartmentID, input.GoalID,
      input.FixedGoal, input.AchievedGoal,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.RevisedGoal ?? null,
    ],
  );
  return { UserGoalDataID: r.insertId, message: 'Goal data logged' };
}

export async function getGoalData(filters: {
  UserID?: number; DepartmentID?: number; GoalID?: number;
  fromDate: string; toDate: string;
}) {
  const conditions = ['ugd.WorkDate BETWEEN ? AND ?'];
  const params: (string | number)[] = [filters.fromDate, filters.toDate];

  if (filters.UserID) { conditions.push('ugd.UserID = ?'); params.push(filters.UserID); }
  if (filters.DepartmentID) { conditions.push('ugd.DepartmentID = ?'); params.push(filters.DepartmentID); }
  if (filters.GoalID) { conditions.push('ugd.GoalID = ?'); params.push(filters.GoalID); }

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT ugd.*, dg.GoalName, dg.GoalMetric, u.UserName
     FROM UserGoalData ugd
     JOIN DepartmentGoal dg ON dg.GoalID = ugd.GoalID
     JOIN Users u ON u.UserID = ugd.UserID
     WHERE ${conditions.join(' AND ')}
     ORDER BY ugd.WorkDate DESC`,
    params,
  );
  return rows;
}

export async function getPmsGoals(filters: { UserID?: number; DepartmentID?: number; Quarter?: string; GoalYear?: number }) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.UserID) { conditions.push('pg.UserID = ?'); params.push(filters.UserID); }
  if (filters.DepartmentID) { conditions.push('pg.DepartmentID = ?'); params.push(filters.DepartmentID); }
  if (filters.Quarter) { conditions.push('pg.Quarter = ?'); params.push(filters.Quarter); }
  if (filters.GoalYear) { conditions.push('pg.GoalYear = ?'); params.push(filters.GoalYear); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT pg.*, u.UserName, dg.GoalName
     FROM PmsGoals pg
     JOIN Users u ON u.UserID = pg.UserID
     LEFT JOIN DepartmentGoal dg ON dg.GoalID = pg.GoalID
     ${where}
     ORDER BY pg.GoalYear DESC, pg.Quarter`,
    params,
  );
  return rows;
}

export async function createPmsGoal(input: {
  UserID: number; DepartmentID: number; GoalID: number;
  Quarter: string; GoalYear: number; GoalTitle: string; Weight: number;
}) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO PmsGoals (UserID, DepartmentID, GoalID, Quarter, GoalYear, GoalTitle, Weight, Status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')`,
    [input.UserID, input.DepartmentID, input.GoalID, input.Quarter, input.GoalYear, input.GoalTitle, input.Weight],
  );
  return { id: r.insertId, message: 'PMS goal created' };
}

export async function updatePmsGoalStatus(id: number, status: string) {
  await pool.execute('UPDATE PmsGoals SET Status = ? WHERE id = ?', [status, id]);
  return { message: 'PMS goal status updated' };
}

export async function updateGoal(goalId: number, input: Record<string, unknown>) {
  const allowed = ['GoalName', 'GoalType', 'TargetValue', 'StartDate', 'EndDate', 'Status'];
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (input[key] !== undefined) { fields.push(`${key} = ?`); values.push(input[key]); }
  }
  if (!fields.length) throw new Error('No fields to update');
  values.push(goalId);
  await pool.query(`UPDATE DepartmentGoal SET ${fields.join(', ')} WHERE GoalID = ?`, values);
  return { message: 'Goal updated' };
}

export async function updateGoalStatus(goalId: number, status: string) {
  await pool.execute('UPDATE DepartmentGoal SET Status = ? WHERE GoalID = ?', [status, goalId]);
  return { message: 'Goal status updated' };
}

export async function approveGoal(input: { GoalID: number; ApprovedBy: number; Status: string }) {
  await pool.execute(
    'UPDATE DepartmentGoal SET Status = ?, ApprovedBy = ? WHERE GoalID = ?',
    [input.Status, input.ApprovedBy, input.GoalID],
  );
  return { message: 'Goal approval updated' };
}
