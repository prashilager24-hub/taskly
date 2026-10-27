import { pool } from '../../config/db';
import { AppError } from '../../utils/AppError';
import type mysql from 'mysql2/promise';

export async function getTasksByDepartment(departmentId: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT TaskID, DepartmentID, TaskName, StandardTimeMins, Frequency, IsForTarget
     FROM DepartmentTask WHERE DepartmentID = ? ORDER BY TaskName`,
    [departmentId],
  );
  return rows;
}

export async function createTask(input: {
  DepartmentID: number; TaskName: string;
  StandardTimeMins: number; Frequency: string; IsForTarget: boolean;
}) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO DepartmentTask (DepartmentID, TaskName, StandardTimeMins, Frequency, IsForTarget)
     VALUES (?, ?, ?, ?, ?)`,
    [input.DepartmentID, input.TaskName, input.StandardTimeMins, input.Frequency, input.IsForTarget ? 1 : 0],
  );
  return { TaskID: r.insertId, message: 'Task created' };
}

export async function updateTask(input: {
  TaskID: number; TaskName?: string;
  StandardTimeMins?: number; Frequency?: string; IsForTarget?: boolean;
}) {
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (input.TaskName !== undefined) { fields.push('TaskName = ?'); values.push(input.TaskName); }
  if (input.StandardTimeMins !== undefined) { fields.push('StandardTimeMins = ?'); values.push(input.StandardTimeMins); }
  if (input.Frequency !== undefined) { fields.push('Frequency = ?'); values.push(input.Frequency); }
  if (input.IsForTarget !== undefined) { fields.push('IsForTarget = ?'); values.push(input.IsForTarget ? 1 : 0); }

  if (!fields.length) throw AppError.badRequest('No fields to update');
  values.push(input.TaskID);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await pool.execute(`UPDATE DepartmentTask SET ${fields.join(', ')} WHERE TaskID = ?`, values as any);
  return { message: 'Task updated' };
}

export async function logWork(input: {
  TaskID: number; UserID: number; WorkDate: string;
  AllocatedTime: number; TimeTakenToWork: number;
  DepartmentID: number; AchivedUnits: number; TaskMeta?: object; RevisedTarget?: number;
}) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO UserWorkData
       (TaskID, UserID, WorkDate, AllocatedTime, TimeTakenToWork,
        DepartmentID, AchivedUnits, TaskMeta, RevisedTarget)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.TaskID, input.UserID, input.WorkDate,
      input.AllocatedTime, input.TimeTakenToWork,
      input.DepartmentID, input.AchivedUnits,
      input.TaskMeta ? JSON.stringify(input.TaskMeta) : null,
      input.RevisedTarget ?? null,
    ],
  );
  return { DailyTaskLogID: r.insertId, message: 'Work logged' };
}

export async function getWorkData(filters: {
  UserID?: number; DepartmentID?: number;
  fromDate: string; toDate: string;
}) {
  const conditions = ['uwd.WorkDate BETWEEN ? AND ?'];
  const params: (string | number)[] = [filters.fromDate, filters.toDate];

  if (filters.UserID) { conditions.push('uwd.UserID = ?'); params.push(filters.UserID); }
  if (filters.DepartmentID) { conditions.push('uwd.DepartmentID = ?'); params.push(filters.DepartmentID); }

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT uwd.*, dt.TaskName, u.UserName, u.EmployeeID
     FROM UserWorkData uwd
     JOIN DepartmentTask dt ON dt.TaskID = uwd.TaskID
     JOIN Users u ON u.UserID = uwd.UserID
     WHERE ${conditions.join(' AND ')}
     ORDER BY uwd.WorkDate DESC, u.UserName`,
    params,
  );
  return rows;
}

export async function getUserLeave(userID: number, fromDate: string, toDate: string) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT LeaveID, UserID, WorkDate, LeaveType
     FROM UserLeave WHERE UserID = ? AND WorkDate BETWEEN ? AND ?
     ORDER BY WorkDate`,
    [userID, fromDate, toDate],
  );
  return rows;
}

export async function logLeave(input: { UserID: number; WorkDate: string; LeaveType: string }) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    'INSERT INTO UserLeave (UserID, WorkDate, LeaveType) VALUES (?, ?, ?)',
    [input.UserID, input.WorkDate, input.LeaveType],
  );
  return { LeaveID: r.insertId, message: 'Leave logged' };
}

export async function updateTaskStatus(taskId: number, status: string) {
  await pool.execute('UPDATE DepartmentTask SET Status = ? WHERE TaskID = ?', [status, taskId]);
  return { message: 'Task status updated' };
}
