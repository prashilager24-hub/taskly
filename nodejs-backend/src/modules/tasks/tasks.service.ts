import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';
import { departmentExists, listDeptItems, type DeptItemListFilter } from '../../utils/deptItemList';
import { javaFail, javaOk, nowLocalDateTime, toBool, toLocalDateTime, toNum } from '../../utils/javaCompat';

// ── Ported from Java DepartmentTaskService — response shapes match the original ──

export interface TaskInput {
  departmentID?: number | null;
  taskName?: string | null;
  standardTimeMins?: number | null;
  frequency?: string | null;
  isDynamic?: boolean | null;
  description?: string | null;
  targetNumber?: number | null;
  isForTarget?: boolean | null;
  timingType?: string | null;
  roleID?: number | null;
}

const TASK_COLUMNS = `
  x.TaskID, x.DepartmentID, x.TaskName, x.StandardTimeMins, x.Frequency, x.IsDynamic,
  x.Description, x.IsActive, x.CreatedAt, x.ModifiedAt, d.DepartmentName,
  x.IsForTarget, x.TargetNumber, x.TimingType, x.RoleID`;

function taskDTO(r: mysql.RowDataPacket) {
  return {
    taskID: r['TaskID'] as number,
    departmentID: r['DepartmentID'] as number,
    taskName: r['TaskName'] as string,
    standardTimeMins: toNum(r['StandardTimeMins']),
    frequency: r['Frequency'] as string | null,
    isDynamic: toBool(r['IsDynamic']),
    description: r['Description'] as string | null,
    isActive: toBool(r['IsActive']),
    createdAt: toLocalDateTime(r['CreatedAt']),
    modifiedAt: toLocalDateTime(r['ModifiedAt']),
    departmentName: r['DepartmentName'] as string,
    isForTarget: toBool(r['IsForTarget']),
    targetNumber: r['TargetNumber'] as number | null,
    timingType: r['TimingType'] as string | null,
    roleID: r['RoleID'] as number | null,
  };
}

/** POST /departmentTasks/list — page/size <= 0 means "everything" */
export async function getAllDepartmentTasks(f: DeptItemListFilter, page: number, size: number, sortBy: string) {
  const list = await listDeptItems(
    { table: 'DepartmentTask', idColumn: 'TaskID', searchColumns: ['TaskName'], select: TASK_COLUMNS },
    f, page, size, sortBy,
  );
  const message = page > 0 && size > 0 ? 'Department tasks retrieved successfully' : 'All department tasks retrieved successfully';
  const { rows, ...paging } = list;
  return javaOk(message, { tasks: rows.map(taskDTO), ...paging, pageSize: paging.pageSize ?? 0 });
}

/** POST /departmentTasks/getTasksByDepartment — active tasks only; Java's { status, statusCode, result } */
export async function getTasksByDepartmentId(departmentId: number) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT ${TASK_COLUMNS} FROM DepartmentTask x JOIN Department d ON x.DepartmentID = d.DepartmentID
     WHERE x.DepartmentID = ? AND x.IsActive = TRUE`,
    [departmentId],
  );
  if (!rows.length) {
    return { status: 'error', statusCode: 404, result: `No tasks found for DepartmentID: ${departmentId}` };
  }
  const result = rows.map((r) => {
    const { departmentName: _omit, ...dto } = taskDTO(r);
    return dto;
  });
  return { status: 'success', statusCode: 200, result };
}

export async function createDepartmentTask(input: TaskInput) {
  if (!input.departmentID || !(await departmentExists(input.departmentID))) return javaFail(404, 'Department not found');
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO DepartmentTask
       (DepartmentID, TaskName, StandardTimeMins, Frequency, IsDynamic, Description, IsActive,
        IsForTarget, TargetNumber, TimingType, RoleID)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    [
      input.departmentID, input.taskName ?? null, input.standardTimeMins ?? null, input.frequency ?? 'Daily',
      input.isDynamic ? 1 : 0, input.description ?? null, input.isForTarget ? 1 : 0,
      input.targetNumber ?? 0, input.timingType ?? null, input.roleID ?? null,
    ],
  );
  return javaOk('Task created successfully', { taskID: r.insertId, taskName: input.taskName, departmentID: input.departmentID });
}

/** PUT /departmentTasks/update/:id — like Java, every field is overwritten from the request */
export async function updateDepartmentTask(taskId: number, input: TaskInput) {
  const [existing] = await pool.query<mysql.RowDataPacket[]>('SELECT DepartmentID FROM DepartmentTask WHERE TaskID = ?', [taskId]);
  if (!existing.length) return javaFail(404, `Task not found with ID: ${taskId}`);
  if (input.departmentID != null && !(await departmentExists(input.departmentID))) return javaFail(404, 'Department not found');
  const departmentID = input.departmentID ?? (existing[0]!['DepartmentID'] as number);

  await pool.execute(
    `UPDATE DepartmentTask SET DepartmentID = ?, TaskName = ?, StandardTimeMins = ?, Frequency = ?, IsDynamic = ?,
       Description = ?, IsForTarget = ?, TargetNumber = ?, TimingType = ?, RoleID = ?, ModifiedAt = NOW()
     WHERE TaskID = ?`,
    [
      departmentID, input.taskName ?? null, input.standardTimeMins ?? null, input.frequency ?? null,
      input.isDynamic == null ? null : input.isDynamic ? 1 : 0, input.description ?? null,
      input.isForTarget == null ? null : input.isForTarget ? 1 : 0, input.targetNumber ?? null,
      input.timingType ?? null, input.roleID ?? null, taskId,
    ],
  );
  return javaOk('Task updated successfully', {
    taskID: taskId, taskName: input.taskName, departmentID, updatedAt: nowLocalDateTime(),
  });
}

/** PUT /departmentTasks/:taskID/status?isActive= */
export async function updateDepartmentTaskStatus(taskId: number, isActive: boolean) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT TaskName FROM DepartmentTask WHERE TaskID = ?', [taskId]);
  if (!rows.length) return javaFail(404, `Task not found with ID: ${taskId}`);
  await pool.execute('UPDATE DepartmentTask SET IsActive = ?, ModifiedAt = NOW() WHERE TaskID = ?', [isActive ? 1 : 0, taskId]);
  return javaOk('Task status updated successfully', {
    taskID: taskId, taskName: rows[0]!['TaskName'], status: isActive ? 'Active' : 'Inactive', updatedAt: nowLocalDateTime(),
  });
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
    `SELECT uwd.*, x.TaskName, u.UserName, u.EmployeeID
     FROM UserWorkData uwd
     JOIN DepartmentTask dt ON x.TaskID = uwd.TaskID
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
