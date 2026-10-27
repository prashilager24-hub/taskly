import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';
import { toBool, toLocalDateTime, toNum } from '../../utils/javaCompat';

// ── Ported from Java CombinedWorkDataService (/combined) — Entry Approval ──
// Lists entries an EL has not approved yet, grouped per work date: the page is taken over
// work rows (or goal rows for entryType GOAL), then every entry on those dates is loaded.

export interface CombinedFilter {
  userID?: number | null;
  departmentID?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  entryType?: string | null; // TASK | TARGET | GOAL; anything else = all
}

const localDate = (v: unknown) => toLocalDateTime(v)?.slice(0, 10) ?? null;
const round2 = (n: number) => Math.round(n * 100) / 100;

function baseFilter(alias: string, f: CombinedFilter, isForTarget: boolean | null) {
  const conds = [`(${alias}.ApprovedByEL IS NULL OR ${alias}.ApprovedByEL = FALSE)`];
  const params: (string | number)[] = [];
  if (f.userID != null) { conds.push(`${alias}.UserID = ?`); params.push(f.userID); }
  if (f.departmentID != null) { conds.push(`${alias}.DepartmentID = ?`); params.push(f.departmentID); }
  if (isForTarget != null) { conds.push(`${alias}.IsForTarget = ?`); params.push(isForTarget ? 1 : 0); }
  if (f.startDate) { conds.push(`${alias}.WorkDate >= ?`); params.push(f.startDate); }
  if (f.endDate) { conds.push(`${alias}.WorkDate <= ?`); params.push(f.endDate); }
  return { conds, params };
}

export async function getCombinedData(f: CombinedFilter, page: number, size: number) {
  const type = f.entryType?.trim().toUpperCase() ?? null;
  const isForTarget = type === 'TASK' ? false : type === 'TARGET' ? true : null;
  const fetchGoals = type !== 'TASK' && type !== 'TARGET';
  const goalOnly = type === 'GOAL';
  const pageSize = size > 0 && size <= 100 ? size : 10;
  const offset = Math.max(page - 1, 0) * pageSize;

  // Step 1: page over work rows (or goal rows) to pick the dates shown
  const table = goalOnly ? 'UserGoalData' : 'UserWorkData';
  const pageFilter = baseFilter('x', f, goalOnly ? null : isForTarget);
  const where = `WHERE ${pageFilter.conds.join(' AND ')}`;
  const [pageRows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT x.WorkDate FROM ${table} x ${where} ORDER BY x.WorkDate DESC LIMIT ? OFFSET ?`,
    [...pageFilter.params, pageSize, offset],
  );
  const [[count]] = await pool.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS n FROM ${table} x ${where}`, pageFilter.params);
  const totalRecords = Number(count?.['n'] ?? 0);
  const pagination = { currentPage: page, pageSize, totalPages: Math.ceil(totalRecords / pageSize), totalRecords };

  const dates = [...new Set(pageRows.map((r) => localDate(r['WorkDate'])!))];
  if (!dates.length) {
    return { status: true, statusCode: 200, message: 'No records found', pagination, data: [] };
  }

  // Steps 2–3: every unapproved work / goal entry on those dates, with names joined in
  const work: mysql.RowDataPacket[] = [];
  if (!goalOnly) {
    const wf = baseFilter('w', f, isForTarget);
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT w.*, us.UserName AS _UserName, d.DepartmentName AS _DepartmentName,
              dt.TaskName AS _TaskName, tg.TargetName AS _TargetName
       FROM UserWorkData w
       LEFT JOIN Users us ON us.UserID = w.UserID
       LEFT JOIN Department d ON d.DepartmentID = w.DepartmentID
       LEFT JOIN DepartmentTask dt ON dt.TaskID = w.TaskID AND w.IsForTarget = FALSE
       LEFT JOIN DepartmentTarget tg ON tg.TargetID = w.TaskID AND w.IsForTarget = TRUE
       WHERE ${wf.conds.join(' AND ')} AND w.WorkDate IN (?)
       ORDER BY w.WorkDate DESC`,
      [...wf.params, dates],
    );
    work.push(...rows);
  }
  const goals: mysql.RowDataPacket[] = [];
  if (fetchGoals) {
    const gf = baseFilter('g', f, null);
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT g.*, us.UserName AS _UserName, d.DepartmentName AS _DepartmentName, dg.GoalName AS _GoalName
       FROM UserGoalData g
       LEFT JOIN Users us ON us.UserID = g.UserID
       LEFT JOIN Department d ON d.DepartmentID = g.DepartmentID
       LEFT JOIN DepartmentGoal dg ON dg.GoalID = g.GoalID
       WHERE ${gf.conds.join(' AND ')} AND g.WorkDate IN (?)
       ORDER BY g.WorkDate DESC`,
      [...gf.params, dates],
    );
    goals.push(...rows);
  }

  // Java resolved user/department names only from the rows it loaded for the page
  const names = new Map<string, string>();
  for (const r of goalOnly ? [...work, ...goals] : work) {
    names.set(`u${r['UserID']}`, r['_UserName']);
    names.set(`d${r['DepartmentID']}`, r['_DepartmentName']);
  }

  const data = dates.map((date) => buildDailySummary(
    date, f,
    work.filter((w) => localDate(w['WorkDate']) === date),
    goals.filter((g) => localDate(g['WorkDate']) === date),
    names,
  ));
  return { status: true, statusCode: 200, message: 'Data retrieved successfully', pagination, data };
}

function buildDailySummary(
  date: string, f: CombinedFilter, work: mysql.RowDataPacket[], goals: mysql.RowDataPacket[], names: Map<string, string>,
) {
  const isTarget = (w: mysql.RowDataPacket) => toBool(w['IsForTarget']) === true;
  const isTask = (w: mysql.RowDataPacket) => toBool(w['IsForTarget']) === false;
  const sum = (rows: mysql.RowDataPacket[], col: string) => rows.reduce((s, r) => s + (toNum(r[col]) ?? 0), 0);

  const leaveType = work.map((w) => w['LeaveType'] as string | null).find((lt) => lt != null && lt !== 'NONE') ?? 'NONE';
  const tasks = work.filter(isTask);
  const targets = work.filter(isTarget);
  const totalUnits = sum(targets, 'Units');
  const userID = work.length ? work[0]!['UserID'] : f.userID ?? null;
  const departmentID = work.length ? work[0]!['DepartmentID'] : f.departmentID ?? null;

  const entries: Record<string, unknown>[] = [];
  for (const w of work) {
    if (w['LeaveType'] === 'FULL_DAY') continue;
    const target = isTarget(w);
    entries.push({
      id: w['DailyTaskLogID'], userID: w['UserID'], departmentID: w['DepartmentID'], workDate: localDate(w['WorkDate']),
      approvedByEL: toBool(w['ApprovedByEL']), commentForRejection: w['CommentForRejection'],
      taskID: isTask(w) ? w['TaskID'] : null, targetID: target ? w['TaskID'] : null, goalID: null,
      taskName: isTask(w) ? w['_TaskName'] ?? null : null, targetName: target ? w['_TargetName'] ?? null : null, goalName: null,
      dailyTaskLogID: w['DailyTaskLogID'], setUp: w['setUp'],
      allocatedTime: toNum(w['AllocatedTime']) ?? 0, timeTakenToWork: toNum(w['TimeTakenToWork']) ?? 0,
      isForTarget: toBool(w['IsForTarget']), overAllTime: toNum(w['OverAllTime']) ?? 0, remarks: w['Remarks'],
      units: toNum(w['Units']), achievedUnits: w['AchivedUnits'] == null ? null : Math.trunc(Number(w['AchivedUnits'])),
      totalUnitValues: w['TotalUnitValues'], isHalfDayLeave: toBool(w['IsHalfDayLeave']), leaveType: w['LeaveType'],
      userGoalDataID: null, fixedGoal: null, achievedGoal: null, goalType: null, isTarget: null,
    });
  }
  for (const g of goals) {
    entries.push({
      id: g['UserGoalDataID'], userID: g['UserID'], departmentID: g['DepartmentID'], workDate: localDate(g['WorkDate']),
      approvedByEL: toBool(g['ApprovedByEL']), commentForRejection: g['CommentForRejection'],
      taskID: null, targetID: null, goalID: g['GoalID'], taskName: null, targetName: null, goalName: g['_GoalName'] ?? null,
      dailyTaskLogID: null, setUp: null, allocatedTime: null, timeTakenToWork: null, isForTarget: null, overAllTime: null,
      remarks: null, units: null, achievedUnits: null, totalUnitValues: null, isHalfDayLeave: null, leaveType: null,
      userGoalDataID: g['UserGoalDataID'], fixedGoal: toNum(g['FixedGoal']) ?? 0, achievedGoal: toNum(g['AchievedGoal']) ?? 0,
      goalType: g['GoalType'], isTarget: toBool(g['Target']),
    });
  }

  return {
    workDate: date,
    userID,
    userName: names.get(`u${userID}`) ?? null,
    departmentID,
    departmentName: names.get(`d${departmentID}`) ?? null,
    leaveType,
    totalAllocatedHrs: round2(sum(tasks, 'AllocatedTime') / 60),
    totalWorkedHrs: round2(sum(tasks, 'TimeTakenToWork') / 60),
    targetAchievedPct: totalUnits > 0 ? Math.round((sum(targets, 'AchivedUnits') / totalUnits) * 10000) / 100 : null,
    entries,
  };
}

/** POST /combined/approve { taskEntryIDs, goalEntryIDs } */
export async function approveEntries(input: { taskEntryIDs?: number[] | null; goalEntryIDs?: number[] | null }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (input.taskEntryIDs?.length) {
      await conn.query('UPDATE UserWorkData SET ApprovedByEL = TRUE WHERE DailyTaskLogID IN (?)', [input.taskEntryIDs]);
    }
    if (input.goalEntryIDs?.length) {
      await conn.query('UPDATE UserGoalData SET ApprovedByEL = TRUE WHERE UserGoalDataID IN (?)', [input.goalEntryIDs]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** POST /combined/reject { id, type: Task|Target|Goal, comment } — stores the EL's rejection comment */
export async function rejectEntry(input: { id?: number | null; type?: string | null; comment?: string | null }) {
  const type = input.type?.toLowerCase();
  if (type === 'task' || type === 'target') {
    await pool.execute('UPDATE UserWorkData SET CommentForRejection = ? WHERE DailyTaskLogID = ?', [input.comment ?? null, input.id ?? null]);
  } else if (type === 'goal') {
    await pool.execute('UPDATE UserGoalData SET CommentForRejection = ? WHERE UserGoalDataID = ?', [input.comment ?? null, input.id ?? null]);
  } else {
    throw new Error(`Invalid type: ${input.type}`);
  }
}
