import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';

interface WorkEntry {
  UserID: number;
  DepartmentID: number;
  TaskID: number;
  WorkDate: string;
  AllocatedTime?: number;
  TimeTakenToWork?: number;
  AchivedUnits?: number;
  TaskMeta?: Record<string, unknown>;
  LeaveType?: string;
  RevisedTarget?: number;
}

export async function bulkCreateWorkData(activities: WorkEntry[]) {
  const results = [];
  for (const entry of activities) {
    if (entry.LeaveType === 'FULL_DAY') {
      // Insert leave entry
      const [r] = await pool.execute<mysql.ResultSetHeader>(
        `INSERT INTO UserWorkData (UserID, DepartmentID, TaskID, WorkDate, LeaveType)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE LeaveType = VALUES(LeaveType)`,
        [entry.UserID, entry.DepartmentID, entry.TaskID ?? 0, entry.WorkDate, entry.LeaveType],
      );
      results.push({ DailyTaskLogID: r.insertId || 0 });
    } else {
      const [r] = await pool.execute<mysql.ResultSetHeader>(
        `INSERT INTO UserWorkData
           (UserID, DepartmentID, TaskID, WorkDate, AllocatedTime, TimeTakenToWork,
            AchivedUnits, TaskMeta, RevisedTarget)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.UserID, entry.DepartmentID, entry.TaskID, entry.WorkDate,
          entry.AllocatedTime ?? null, entry.TimeTakenToWork ?? null,
          entry.AchivedUnits ?? null,
          entry.TaskMeta ? JSON.stringify(entry.TaskMeta) : null,
          entry.RevisedTarget ?? null,
        ],
      );
      results.push({ DailyTaskLogID: r.insertId });
    }
  }
  return results;
}

export async function bulkWork(input: {
  UserID?: number;
  DepartmentID?: number;
  WorkDate?: string;
  LeaveType?: string;
  activities?: WorkEntry[];
  goals?: Record<string, unknown>[];
}) {
  // Full day leave shortcut
  if (input.LeaveType === 'FULL_DAY') {
    if (!input.UserID || !input.DepartmentID || !input.WorkDate) {
      throw new Error('UserID, DepartmentID and WorkDate are required for FULL_DAY leave');
    }
    await pool.execute(
      `INSERT INTO UserWorkData (UserID, DepartmentID, TaskID, WorkDate, LeaveType)
       VALUES (?, ?, 0, ?, 'FULL_DAY')
       ON DUPLICATE KEY UPDATE LeaveType = 'FULL_DAY'`,
      [input.UserID, input.DepartmentID, input.WorkDate],
    );
    return { message: 'Full day leave saved' };
  }

  // Normal flow
  if (input.activities?.length) {
    await bulkCreateWorkData(input.activities);
  }
  if (input.goals?.length) {
    for (const goal of input.goals) {
      await pool.query(
        `INSERT INTO UserGoalData (UserID, DepartmentID, GoalID, WorkDate, AchievedValue, Notes)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE AchievedValue = VALUES(AchievedValue), Notes = VALUES(Notes)`,
        [goal['UserID'], goal['DepartmentID'], goal['GoalID'], goal['WorkDate'],
         goal['AchievedValue'] ?? 0, goal['Notes'] ?? null],
      );
    }
  }
  return { message: 'Saved' };
}

export async function listWorkData(
  filter: { UserID?: number; DepartmentID?: number; startDate?: string; endDate?: string; TaskID?: number },
  page?: number,
  size?: number,
  sortBy?: string,
) {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];

  if (filter.UserID) { conditions.push('wd.UserID = ?'); params.push(filter.UserID); }
  if (filter.DepartmentID) { conditions.push('wd.DepartmentID = ?'); params.push(filter.DepartmentID); }
  if (filter.startDate) { conditions.push('wd.WorkDate >= ?'); params.push(filter.startDate); }
  if (filter.endDate) { conditions.push('wd.WorkDate <= ?'); params.push(filter.endDate); }
  if (filter.TaskID) { conditions.push('wd.TaskID = ?'); params.push(filter.TaskID); }

  const orderClause = sortBy ? `ORDER BY wd.${sortBy}` : 'ORDER BY wd.WorkDate DESC';
  const where = `WHERE ${conditions.join(' AND ')}`;

  const baseQuery = `
    SELECT wd.*, u.UserName, d.DepartmentName, t.TaskName
    FROM UserWorkData wd
    LEFT JOIN Users u ON u.UserID = wd.UserID
    LEFT JOIN Department d ON d.DepartmentID = wd.DepartmentID
    LEFT JOIN DepartmentTask t ON t.TaskID = wd.TaskID
    ${where}
    ${orderClause}`;

  if (page && size) {
    const offset = (page - 1) * size;
    const [rows] = await pool.query<mysql.RowDataPacket[]>(`${baseQuery} LIMIT ? OFFSET ?`, [...params, size, offset]);
    const [[countRow]] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM UserWorkData wd ${where}`, params,
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

export async function bulkUpdateWorkData(input: {
  activities?: Array<{ DailyTaskLogID: number; [key: string]: unknown }>;
  goals?: Array<{ UserGoalDataID: number; [key: string]: unknown }>;
}) {
  if (input.activities?.length) {
    const allowed = ['AllocatedTime', 'TimeTakenToWork', 'AchivedUnits', 'TaskMeta', 'RevisedTarget'];
    for (const entry of input.activities) {
      const fields: string[] = [];
      const values: unknown[] = [];
      for (const key of allowed) {
        if (entry[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(key === 'TaskMeta' ? JSON.stringify(entry[key]) : entry[key]);
        }
      }
      if (fields.length) {
        values.push(entry['DailyTaskLogID']);
        await pool.query(`UPDATE UserWorkData SET ${fields.join(', ')} WHERE DailyTaskLogID = ?`, values);
      }
    }
  }
  if (input.goals?.length) {
    for (const goal of input.goals) {
      const fields: string[] = [];
      const values: unknown[] = [];
      if (goal['AchievedValue'] !== undefined) { fields.push('AchievedValue = ?'); values.push(goal['AchievedValue']); }
      if (goal['Notes'] !== undefined) { fields.push('Notes = ?'); values.push(goal['Notes']); }
      if (fields.length) {
        values.push(goal['UserGoalDataID']);
        await pool.query(`UPDATE UserGoalData SET ${fields.join(', ')} WHERE UserGoalDataID = ?`, values);
      }
    }
  }
  return { message: 'Updated Successfully' };
}

export async function updateRevisedTarget(
  input: { DailyTaskLogID: number; RevisedTarget: number; Reason?: string },
  _currentUserId?: number,
) {
  await pool.execute(
    'UPDATE UserWorkData SET RevisedTarget = ? WHERE DailyTaskLogID = ?',
    [input.RevisedTarget, input.DailyTaskLogID],
  );
  const [[row]] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT * FROM UserWorkData WHERE DailyTaskLogID = ?',
    [input.DailyTaskLogID],
  );
  return row;
}

export async function getRevisedTargetByLogId(dailyTaskLogID: number) {
  const [[row]] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT wd.*, t.TaskName, u.UserName
     FROM UserWorkData wd
     LEFT JOIN DepartmentTask t ON t.TaskID = wd.TaskID
     LEFT JOIN Users u ON u.UserID = wd.UserID
     WHERE wd.DailyTaskLogID = ?`,
    [dailyTaskLogID],
  );
  return row ?? null;
}

export async function getRevisedTarget(
  userID: number,
  taskID: number,
  workDate: string,
  isForTarget?: boolean,
) {
  const conditions = ['wd.UserID = ?', 'wd.TaskID = ?', 'wd.WorkDate = ?'];
  const params: unknown[] = [userID, taskID, workDate];
  if (isForTarget !== undefined) {
    conditions.push('t.IsForTarget = ?');
    params.push(isForTarget ? 1 : 0);
  }
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT wd.*, t.TaskName, t.IsForTarget
     FROM UserWorkData wd
     LEFT JOIN DepartmentTask t ON t.TaskID = wd.TaskID
     WHERE ${conditions.join(' AND ')}
     ORDER BY wd.DailyTaskLogID DESC LIMIT 1`,
    params,
  );
  return rows[0] ?? null;
}

export async function updateGoalAchievement(input: {
  UserGoalDataID: number;
  AchievedValue: number;
  Notes?: string;
}) {
  await pool.execute(
    'UPDATE UserGoalData SET AchievedValue = ?, Notes = ? WHERE UserGoalDataID = ?',
    [input.AchievedValue, input.Notes ?? null, input.UserGoalDataID],
  );
  const [[row]] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT * FROM UserGoalData WHERE UserGoalDataID = ?',
    [input.UserGoalDataID],
  );
  return row;
}
