import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';
import { AppError } from '../../utils/AppError';
import { toBool, toLocalDateTime, toNum } from '../../utils/javaCompat';

// ── Ported from Java UserWorkDataService (/form) — request and response shapes match the original ──

export interface WorkEntryInput {
  dailyTaskLogID?: number | null;
  taskID?: number | null;
  userID?: number | null;
  workDate?: string | null;
  setUp?: number | null;
  allocatedTime?: number | null;
  timeTakenToWork?: number | null;
  isForTarget?: boolean | null;
  overAllTime?: number | null;
  remarks?: string | null;
  units?: number | null;
  departmentID?: number | null;
  achivedUnits?: number | null;
  totalUnitValues?: string | null;
  targetID?: number | null;
  totalTimePerSetup?: number | null;
  isHalfDayLeave?: boolean | null;
  leaveType?: string | null;
  taskMeta?: number[] | null;
}

export interface GoalEntryInput {
  userGoalDataID?: number | null;
  workDate?: string | null;
  userID?: number | null;
  departmentID?: number | null;
  goalID?: number | null;
  fixedGoal?: number | null;
  achievedGoal?: number | null;
  goalType?: string | null;
  comment?: string | null;
  metaData?: Record<string, unknown>[] | null;
}

export interface WorkAndGoalInput {
  leaveType?: string | null;
  userID?: number | null;
  departmentID?: number | null;
  workDate?: string | null;
  activities?: WorkEntryInput[] | null;
  goals?: GoalEntryInput[] | null;
}

export interface WorkListFilter {
  userID?: number | null;
  roleID?: number | null;
  departmentID?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  isForTarget?: boolean | null;
  taskID?: number | null;
  eLID?: number | null;
}

interface RevisedTarget {
  value?: number | null;
  enteredBy?: number | null;
  enteredAt?: string | null;
  elApproved?: boolean | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
  comment?: string | null;
}

const auditNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 19).replace('T', ' ');
};

function parseJson<T>(raw: unknown): T | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

// Jackson writes every RevisedTargetDetailsDTO field, nulls included
const revisedTargetJson = (rt: RevisedTarget) => JSON.stringify({
  value: rt.value ?? null, enteredBy: rt.enteredBy ?? null, enteredAt: rt.enteredAt ?? null,
  elApproved: rt.elApproved ?? null, approvedBy: rt.approvedBy ?? null, approvedAt: rt.approvedAt ?? null,
  comment: rt.comment ?? null,
});

// ── Create ───────────────────────────────────────────────────────────────────

export async function bulkCreateUserWorkData(entries: WorkEntryInput[]) {
  const created = [];
  for (const e of entries) {
    const leaveType = e.leaveType ?? 'NONE';
    const fullDay = leaveType.toUpperCase() === 'FULL_DAY';
    const [r] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO UserWorkData
         (TaskID, UserID, WorkDate, AllocatedTime, TimeTakenToWork, AchivedUnits, Units, IsForTarget,
          LeaveType, DepartmentID, Remarks, TaskMeta, CreatedAt, UpdatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      fullDay
        ? [null, e.userID ?? null, e.workDate ?? null, 0, 0, 0, 0, 0, 'FULL_DAY',
           e.departmentID ?? null, e.remarks ?? null, e.taskMeta ? JSON.stringify(e.taskMeta) : null]
        : [
            // taskID 0 means "this row is a target" — Java stored targetID in the TaskID column
            e.taskID === 0 ? e.targetID ?? null : e.taskID ?? null,
            e.userID ?? null, e.workDate ?? null, e.totalTimePerSetup ?? 0, e.timeTakenToWork ?? 0,
            e.achivedUnits ?? 0, e.units ?? null, e.isForTarget == null ? null : e.isForTarget ? 1 : 0, leaveType,
            e.departmentID ?? null, e.remarks ?? null, e.taskMeta ? JSON.stringify(e.taskMeta) : null,
          ],
    );
    created.push(r.insertId);
  }
  return loadWorkRows(created);
}

/** Department 18 goals are not stored here (Java routed them to MIS logging, now disabled) */
export async function bulkUpsertUserGoalData(goals: GoalEntryInput[]) {
  for (const g of goals) {
    if (g.departmentID == null || g.departmentID === 18) continue;
    const metaData = g.metaData?.length ? JSON.stringify(g.metaData) : undefined;
    const [existing] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT UserGoalDataID FROM UserGoalData WHERE WorkDate = ? AND UserID = ? AND GoalID = ? AND GoalType IS NULL LIMIT 1',
      [g.workDate, g.userID, g.goalID],
    );
    if (existing.length) {
      await pool.execute(
        `UPDATE UserGoalData SET DepartmentID = ?, FixedGoal = ?, AchievedGoal = ?, Comment = ?,
           ${metaData !== undefined ? 'metadata = ?,' : ''} ModifiedAt = NOW()
         WHERE UserGoalDataID = ?`,
        [g.departmentID, g.fixedGoal ?? null, g.achievedGoal ?? null, g.comment ?? null,
         ...(metaData !== undefined ? [metaData] : []), existing[0]!['UserGoalDataID']],
      );
    } else {
      await pool.execute(
        `INSERT INTO UserGoalData (WorkDate, UserID, DepartmentID, GoalID, FixedGoal, AchievedGoal, Comment, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [g.workDate ?? null, g.userID ?? null, g.departmentID, g.goalID ?? null, g.fixedGoal ?? null,
         g.achievedGoal ?? null, g.comment ?? null, metaData ?? null],
      );
    }
  }
}

/** POST /form/bulkWork — returns Java's plain-text bodies */
export async function bulkWork(input: WorkAndGoalInput): Promise<{ httpStatus: number; body: string }> {
  if (input.leaveType?.toUpperCase() === 'FULL_DAY') {
    if (input.userID == null || input.departmentID == null || input.workDate == null) {
      return { httpStatus: 400, body: 'UserID, DepartmentID and WorkDate are required for FULL_DAY leave' };
    }
    await bulkCreateUserWorkData([{
      userID: input.userID, departmentID: input.departmentID, workDate: input.workDate, leaveType: 'FULL_DAY',
    }]);
    return { httpStatus: 200, body: 'Full day leave saved' };
  }
  if (input.activities?.length) await bulkCreateUserWorkData(input.activities);
  if (input.goals?.length) await bulkUpsertUserGoalData(input.goals);
  return { httpStatus: 200, body: 'Saved' };
}

// ── Update ───────────────────────────────────────────────────────────────────

/** PATCH /form/bulkUpdate — rows are matched by id; editing clears any EL rejection comment */
export async function bulkUpdateWorkAndGoals(input: WorkAndGoalInput) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const a of input.activities ?? []) {
      if (a.dailyTaskLogID == null) continue;
      const [r] = await conn.execute<mysql.ResultSetHeader>(
        `UPDATE UserWorkData SET AllocatedTime = ?, TimeTakenToWork = ?, Remarks = ?, Units = ?, AchivedUnits = ?,
           SetUp = ?, ${a.taskMeta != null ? 'TaskMeta = ?,' : ''} CommentForRejection = NULL, UpdatedAt = NOW()
         WHERE DailyTaskLogID = ?`,
        [a.allocatedTime ?? null, a.timeTakenToWork ?? null, a.remarks ?? null, a.units ?? null,
         a.achivedUnits ?? null, a.setUp ?? null, ...(a.taskMeta != null ? [JSON.stringify(a.taskMeta)] : []),
         a.dailyTaskLogID],
      );
      if (!r.affectedRows) throw AppError.notFound('Task not found');
    }
    for (const g of input.goals ?? []) {
      if (g.userGoalDataID == null) continue;
      const [r] = await conn.execute<mysql.ResultSetHeader>(
        `UPDATE UserGoalData SET AchievedGoal = ?, FixedGoal = ?, CommentForRejection = NULL, ModifiedAt = NOW()
         WHERE UserGoalDataID = ?`,
        [g.achievedGoal ?? null, g.fixedGoal ?? null, g.userGoalDataID],
      );
      if (!r.affectedRows) throw AppError.notFound('Goal not found');
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// ── List ─────────────────────────────────────────────────────────────────────

function listWhere(f: WorkListFilter, userID: number | null | undefined, paginated: boolean) {
  const conds: string[] = [];
  const params: (string | number)[] = [];
  if (userID) { conds.push('u.UserID = ?'); params.push(userID); }
  if (f.departmentID) { conds.push('u.DepartmentID = ?'); params.push(f.departmentID); }
  // Paginated list only: dept 42 with no dates shows its still-pending entries up to today
  if (paginated && f.departmentID === 42 && !f.startDate && !f.endDate) {
    conds.push(`LOWER(TRIM(u.Remarks)) = 'pending'`, 'u.WorkDate <= CURDATE()');
  } else {
    if (f.startDate) { conds.push('u.WorkDate >= ?'); params.push(f.startDate); }
    if (f.endDate) { conds.push('u.WorkDate <= ?'); params.push(f.endDate); }
  }
  if (f.isForTarget != null) { conds.push('u.IsForTarget = ?'); params.push(f.isForTarget ? 1 : 0); }
  if (f.taskID) { conds.push('u.TaskID = ?'); params.push(f.taskID); }
  if (f.eLID) { conds.push('d.ExecutiveLeaderID = ?'); params.push(f.eLID); }
  return { where: conds.length ? `WHERE ${conds.join(' AND ')}` : '', params };
}

const WORK_SELECT = `
  SELECT u.*, us.UserName AS _UserName, d.DepartmentName AS _DepartmentName,
         CASE WHEN u.LeaveType = 'FULL_DAY' THEN 'FULL DAY LEAVE'
              WHEN u.IsForTarget = 0 THEN dt.TaskName
              ELSE tg.TargetName END AS _TaskName
  FROM UserWorkData u
  JOIN Department d ON d.DepartmentID = u.DepartmentID
  LEFT JOIN Users us ON us.UserID = u.UserID
  LEFT JOIN DepartmentTask dt ON dt.TaskID = u.TaskID
  LEFT JOIN DepartmentTarget tg ON tg.TargetID = u.TaskID`;

async function loadWorkRows(ids: number[]) {
  if (!ids.length) return [];
  const [rows] = await pool.query<mysql.RowDataPacket[]>(`${WORK_SELECT} WHERE u.DailyTaskLogID IN (?)`, [ids]);
  return mapWorkRows(rows);
}

/** Java UserWorkDataService.mapToResponse; dept 23 rows carry the user's TAM accounts */
async function mapWorkRows(rows: mysql.RowDataPacket[]) {
  const tamUsers = [...new Set(rows.filter((r) => r['DepartmentID'] === 23).map((r) => r['UserID'] as number))];
  const tamByUser = new Map<number, unknown[]>();
  if (tamUsers.length) {
    const [accounts] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT * FROM tam_accounts WHERE created_by_user_id IN (?)', [tamUsers]);
    for (const a of accounts) {
      const list = tamByUser.get(a['created_by_user_id'] as number) ?? [];
      list.push({
        accountId: Number(a['account_id']),
        publisherName: a['publisher_name'],
        status: a['status'],
        entryDate: toLocalDateTime(a['entry_date'])?.slice(0, 10) ?? null,
        liveDate: toLocalDateTime(a['live_date'])?.slice(0, 10) ?? null,
        createdByUserID: a['created_by_user_id'],
        updatedByUserID: a['updated_by_user_id'],
        createdAt: toLocalDateTime(a['created_at']),
        updatedAt: toLocalDateTime(a['updated_at']),
      });
      tamByUser.set(a['created_by_user_id'] as number, list);
    }
  }

  return rows.map((r) => ({
    dailyTaskLogID: r['DailyTaskLogID'],
    taskID: r['TaskID'],
    taskName: r['_TaskName'] ?? null,
    userID: r['UserID'],
    userName: r['_UserName'] ?? null,
    departmentID: r['DepartmentID'],
    departmentName: r['_DepartmentName'] ?? null,
    workDate: toLocalDateTime(r['WorkDate'])?.slice(0, 10) ?? null,
    setUp: r['setUp'],
    units: toNum(r['Units']),
    revisedTarget: parseJson<RevisedTarget>(r['RevisedTarget']),
    approvedByEL: toBool(r['ApprovedByEL']),
    taskMeta: parseJson<number[]>(r['TaskMeta']),
    allocatedTime: toNum(r['AllocatedTime']),
    timeTakenToWork: toNum(r['TimeTakenToWork']),
    isForTarget: toBool(r['IsForTarget']),
    overAllTime: toNum(r['OverAllTime']),
    remarks: r['Remarks'],
    achivedUnits: r['AchivedUnits'] == null ? null : Math.trunc(Number(r['AchivedUnits'])),
    totalUnitValues: r['TotalUnitValues'],
    createdAt: r['CreatedAt'] instanceof Date ? (r['CreatedAt'] as Date).toISOString() : r['CreatedAt'],
    updatedAt: r['UpdatedAt'] instanceof Date ? (r['UpdatedAt'] as Date).toISOString() : r['UpdatedAt'],
    leaveType: r['LeaveType'],
    tamAccounts: r['DepartmentID'] === 23 ? tamByUser.get(r['UserID'] as number) ?? [] : null,
  }));
}

/** POST /form/list without page/size — every matching row */
export async function listAll(f: WorkListFilter) {
  const { where, params } = listWhere(f, f.userID, false);
  const [rows] = await pool.query<mysql.RowDataPacket[]>(`${WORK_SELECT} ${where} ORDER BY u.WorkDate DESC`, params);
  const list = await mapWorkRows(rows);
  return {
    status: true, statusCode: 200, message: 'User work data retrieved successfully',
    response: {
      userWorkDataList: list, totalRecords: list.length, totalPages: 1, currentPage: 1, pageSize: list.length,
      avgAllocatedHrs: null, avgTotalWork: null,
    },
  };
}

/** POST /form/list?page=&size=&sortBy= — admins and ELs viewing themselves see everyone's rows */
export async function listPaginated(f: WorkListFilter, page: number, size: number, sortBy?: string) {
  const pageSize = size > 0 && size <= 100 ? size : 10;
  const pageIndex = page > 0 ? page - 1 : 0;

  let userID = f.userID ?? null;
  if (userID != null && f.roleID != null && (f.roleID === 1 || f.roleID === 3)) {
    const [[u]] = await pool.query<mysql.RowDataPacket[]>('SELECT RoleID FROM Users WHERE UserID = ?', [userID]);
    if (u && u['RoleID'] === f.roleID) userID = null;
  }

  const { where, params } = listWhere(f, userID, true);
  const sortColumn = sortBy?.toLowerCase() === 'workdate' ? 'u.WorkDate' : 'u.DailyTaskLogID';
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `${WORK_SELECT} ${where} ORDER BY u.WorkDate DESC, ${sortColumn} DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, pageIndex * pageSize],
  );
  const [[count]] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM UserWorkData u JOIN Department d ON d.DepartmentID = u.DepartmentID ${where}`, params);
  const totalRecords = Number(count?.['n'] ?? 0);

  // Averages are per user-day hours over working days, excluding full-day leave (Java findOverallAverages)
  const avgConds: string[] = [`(u.LeaveType IS NULL OR u.LeaveType <> 'FULL_DAY')`, 'DAYOFWEEK(u.WorkDate) NOT IN (1, 7)'];
  const avgParams: (string | number)[] = [];
  if (userID) { avgConds.push('u.UserID = ?'); avgParams.push(userID); }
  if (f.departmentID) { avgConds.push('u.DepartmentID = ?'); avgParams.push(f.departmentID); }
  if (f.startDate) { avgConds.push('u.WorkDate >= ?'); avgParams.push(f.startDate); }
  if (f.endDate) { avgConds.push('u.WorkDate <= ?'); avgParams.push(f.endDate); }
  if (f.taskID) { avgConds.push('u.TaskID = ?'); avgParams.push(f.taskID); }
  if (f.isForTarget != null) { avgConds.push('u.IsForTarget = ?'); avgParams.push(f.isForTarget ? 1 : 0); }
  if (f.eLID) { avgConds.push('u.DepartmentID IN (SELECT DepartmentID FROM Department WHERE ExecutiveLeaderID = ?)'); avgParams.push(f.eLID); }
  const [[avg]] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COALESCE(ROUND(AVG(daily_allocated), 2), 0) AS avgAllocated, COALESCE(ROUND(AVG(daily_work), 2), 0) AS avgWork
     FROM (SELECT u.UserID, DATE(u.WorkDate) AS work_day,
                  SUM(u.AllocatedTime) / 60 AS daily_allocated, SUM(u.TimeTakenToWork) / 60 AS daily_work
           FROM UserWorkData u WHERE ${avgConds.join(' AND ')}
           GROUP BY u.UserID, DATE(u.WorkDate)) t`,
    avgParams,
  );

  return {
    status: true, statusCode: 200, message: 'Paginated user work data retrieved successfully',
    response: {
      userWorkDataList: await mapWorkRows(rows),
      totalRecords,
      totalPages: Math.ceil(totalRecords / pageSize),
      currentPage: page,
      pageSize,
      avgAllocatedHrs: Number(avg?.['avgAllocated'] ?? 0),
      avgTotalWork: Number(avg?.['avgWork'] ?? 0),
    },
  };
}

// ── Revised target ───────────────────────────────────────────────────────────

async function resolveWorkRow(q: { dailyTaskLogID?: number | null; userID?: number | null; taskID?: number | null; workDate?: string | null; isForTarget?: boolean | null }) {
  if (q.dailyTaskLogID != null) {
    const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM UserWorkData WHERE DailyTaskLogID = ?', [q.dailyTaskLogID]);
    if (!rows.length) throw AppError.notFound(`UserWorkData not found with id: ${q.dailyTaskLogID}`);
    return rows[0]!;
  }
  if (q.userID != null && q.taskID != null && q.workDate != null) {
    const params: (string | number)[] = [q.userID, q.taskID, q.workDate];
    let target = '';
    if (q.isForTarget != null) { target = 'AND IsForTarget = ?'; params.push(q.isForTarget ? 1 : 0); }
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM UserWorkData WHERE UserID = ? AND TaskID = ? AND WorkDate = ? ${target}`, params);
    if (!rows.length) {
      throw AppError.notFound(`UserWorkData not found for userID=${q.userID}, taskID=${q.taskID}, workDate=${q.workDate}`);
    }
    return rows[0]!;
  }
  throw AppError.badRequest('Provide either dailyTaskLogID or userID + taskID + workDate');
}

const emptyRevisedTarget = (): Required<RevisedTarget> => ({
  value: null, enteredBy: null, enteredAt: null, elApproved: null, approvedBy: null, approvedAt: null, comment: null,
});

export async function getRevisedTarget(q: Parameters<typeof resolveWorkRow>[0]) {
  const row = await resolveWorkRow(q);
  return { ...emptyRevisedTarget(), ...(parseJson<RevisedTarget>(row['RevisedTarget']) ?? {}) };
}

/**
 * PUT /form/revised-target — merges the given fields into the stored revisedTarget JSON.
 * action APPROVE/REJECT stamps elApproved/approvedBy/approvedAt; clear=true removes it.
 */
export async function updateRevisedTarget(
  input: { dailyTaskLogID?: number | null; userID?: number | null; taskID?: number | null; workDate?: string | null;
    isForTarget?: boolean | null; revisedTarget?: RevisedTarget | null; action?: string | null; clear?: boolean | null },
  currentUserId: number | null,
) {
  const row = await resolveWorkRow(input);
  const action = input.action?.trim().toUpperCase() ?? null;
  const now = auditNow();

  let merged: RevisedTarget | null;
  if (input.clear === true) {
    merged = null;
  } else if (input.revisedTarget) {
    merged = parseJson<RevisedTarget>(row['RevisedTarget']) ?? {};
    for (const [k, v] of Object.entries(input.revisedTarget)) {
      if (v != null) (merged as Record<string, unknown>)[k] = v;
    }
  } else {
    merged = parseJson<RevisedTarget>(row['RevisedTarget']);
  }
  if (merged == null && action != null) merged = {};

  if (merged) {
    if (action === 'APPROVE' || action === 'REJECT') {
      merged.elApproved = action === 'APPROVE';
      merged.approvedBy = currentUserId;
      merged.approvedAt = now;
    }
    if (merged.value != null && merged.enteredAt == null) merged.enteredAt = now;
    if (merged.value != null && merged.enteredBy == null) merged.enteredBy = currentUserId;
  }

  await pool.execute('UPDATE UserWorkData SET RevisedTarget = ?, UpdatedAt = NOW() WHERE DailyTaskLogID = ?',
    [merged ? revisedTargetJson(merged) : null, row['DailyTaskLogID']]);
  const [updated] = await loadWorkRows([row['DailyTaskLogID'] as number]);
  return updated;
}

// ── Goal achievement (PUT /form/goal/update) ─────────────────────────────────

/**
 * Port of Java UserGoalDataService.updateGoal. The update itself matches Java; the response
 * carries the plain achieved/fixed efficiency — Java's department-specific recalculation
 * (depts 13, 37, …) lands with the userGoalData module port. The frontend ignores this body.
 */
export async function updateGoal(input: { userId: number; goalId: number; workDate: string; achievedGoal?: number | null; comment?: string | null }) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT UserGoalDataID FROM UserGoalData WHERE UserID = ? AND GoalID = ? AND WorkDate = ? LIMIT 1',
    [input.userId, input.goalId, input.workDate],
  );
  if (!rows.length) throw new AppError('Goal data not found', 500);
  const id = rows[0]!['UserGoalDataID'] as number;
  await pool.execute('UPDATE UserGoalData SET AchievedGoal = ?, Comment = ?, ModifiedAt = NOW() WHERE UserGoalDataID = ?',
    [input.achievedGoal ?? null, input.comment ?? null, id]);

  const [[g]] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT g.*, u.UserName, dg.GoalName FROM UserGoalData g
     LEFT JOIN Users u ON u.UserID = g.UserID LEFT JOIN DepartmentGoal dg ON dg.GoalID = g.GoalID
     WHERE g.UserGoalDataID = ?`, [id]);
  const fixed = toNum(g!['FixedGoal']) ?? 0;
  const achieved = toNum(g!['AchievedGoal']) ?? 0;
  return {
    userGoalDataID: id,
    workDate: toLocalDateTime(g!['WorkDate'])?.slice(0, 10) ?? null,
    userID: g!['UserID'],
    userName: g!['UserName'] ?? null,
    departmentID: g!['DepartmentID'],
    goalID: g!['GoalID'],
    goalName: g!['GoalName'] ?? null,
    fixedGoal: fixed,
    achievedGoal: achieved,
    goalEfficiencyPercent: fixed > 0 ? Math.round((achieved / fixed) * 10000) / 100 : 0,
    recalculatedTarget: null,
    comment: g!['Comment'] ?? null,
    revisedGoal: parseJson(g!['RevisedGoal']),
    approvedByEL: toBool(g!['ApprovedByEL']),
  };
}
