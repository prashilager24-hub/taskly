import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';
import { javaFail, javaOk, toBool, toLocalDateTime } from '../../utils/javaCompat';
import { departmentExists, listDeptItems, type DeptItemListFilter } from '../../utils/deptItemList';

// ── Ported from Java DepartmentGoalService — response shapes match the original ──

export interface GoalInput {
  departmentID?: number | null;
  goalName?: string | null;
  goalMetric?: string | null;
  metricValue?: string | null;
  liveAccounts?: number | null;
  unit?: string | null;
  frequency?: string | null;
  timingType?: string | null;
  isDynamic?: boolean | null;
  description?: string | null;
  isActive?: boolean | null;
  roleID?: number | null;
}

const bit = (v: boolean | null | undefined) => (v == null ? null : v ? 1 : 0);

export async function createDepartmentGoal(input: GoalInput) {
  if (!input.departmentID || !(await departmentExists(input.departmentID))) return javaFail(404, 'Department not found');
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO DepartmentGoal
       (DepartmentID, GoalName, GoalMetric, LiveAccounts, MetricValue, Unit, Frequency, TimingType,
        IsDynamic, Description, IsActive, RoleID)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      input.departmentID, input.goalName ?? null, input.goalMetric ?? '', input.liveAccounts ?? 0,
      input.metricValue ?? null, input.unit ?? null, input.frequency ?? 'Daily', input.timingType ?? null,
      bit(input.isDynamic) ?? 0, input.description ?? null, input.roleID ?? null,
    ],
  );
  return javaOk('Department goal created successfully', { goalID: r.insertId, departmentID: input.departmentID });
}

/** Like Java, every field is overwritten from the request */
export async function updateDepartmentGoal(goalId: number, input: GoalInput) {
  const [existing] = await pool.query<mysql.RowDataPacket[]>('SELECT DepartmentID FROM DepartmentGoal WHERE GoalID = ?', [goalId]);
  if (!existing.length) return javaFail(404, `Goal not found with ID: ${goalId}`);
  if (input.departmentID != null && !(await departmentExists(input.departmentID))) return javaFail(500, 'Error updating department goal');

  await pool.execute(
    `UPDATE DepartmentGoal SET DepartmentID = ?, GoalName = ?, GoalMetric = ?, LiveAccounts = ?, MetricValue = ?,
       Unit = ?, Frequency = ?, TimingType = ?, IsDynamic = ?, Description = ?, IsActive = ?, RoleID = ?,
       ModifiedAt = NOW()
     WHERE GoalID = ?`,
    [
      input.departmentID ?? existing[0]!['DepartmentID'], input.goalName ?? null, input.goalMetric ?? '',
      input.liveAccounts ?? 0, input.metricValue ?? null, input.unit ?? null, input.frequency ?? null,
      input.timingType ?? null, bit(input.isDynamic), input.description ?? null, bit(input.isActive),
      input.roleID ?? null, goalId,
    ],
  );
  return javaOk('Department goal updated successfully');
}

export async function updateDepartmentGoalStatus(goalId: number, isActive: boolean) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    'UPDATE DepartmentGoal SET IsActive = ?, ModifiedAt = NOW() WHERE GoalID = ?',
    [isActive ? 1 : 0, goalId],
  );
  if (!r.affectedRows) return javaFail(404, 'Goal not found');
  return javaOk('Goal status updated successfully');
}

/**
 * POST /departmentGoals/getGoalsByDepartment — Java's { statusCode, status, result }.
 * departmentId 0 → all active goals (admin); roleId > 0 narrows to that role.
 */
export async function getGoalsByDepartmentId(departmentId: number, roleId: number) {
  const conds = ['g.IsActive = TRUE'];
  const params: number[] = [];
  if (departmentId) { conds.push('g.DepartmentID = ?'); params.push(departmentId); }
  if (departmentId && roleId > 0) { conds.push('g.RoleID = ?'); params.push(roleId); }

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT g.GoalID, g.DepartmentID, g.GoalName, g.GoalMetric, g.MetricValue, g.Unit, g.Frequency,
            g.TimingType, g.IsDynamic, g.IsActive, g.RoleID
     FROM DepartmentGoal g WHERE ${conds.join(' AND ')}`,
    params,
  );
  if (!rows.length) return { statusCode: 404, status: 'error', result: 'No goals found' };

  const result = [];
  for (const g of rows) {
    let metricValue = g['MetricValue'] as string | null;
    // Java special case: dept 1 / goal 65 targets 105% of the last 7 days' achieved total
    if (g['DepartmentID'] === 1 && g['GoalID'] === 65) {
      const [[sum]] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT COALESCE(SUM(AchievedGoal), 0) AS s FROM UserGoalData
         WHERE DepartmentID = 1 AND GoalID = 65
           AND WorkDate BETWEEN CURDATE() - INTERVAL 7 DAY AND CURDATE() - INTERVAL 1 DAY`,
      );
      metricValue = (Number(sum?.['s'] ?? 0) * 1.05).toFixed(2);
    }
    result.push({
      goalID: g['GoalID'],
      goalName: g['GoalName'],
      goalMetric: g['GoalMetric'],
      metricValue,
      unit: g['Unit'],
      frequency: g['Frequency'],
      timingType: g['TimingType'],
      isDynamic: toBool(g['IsDynamic']),
      isActive: toBool(g['IsActive']),
      roleID: g['RoleID'],
    });
  }
  return { statusCode: 200, status: 'success', result };
}

/** POST /departmentGoals/list?page=&size=&sortBy= */
export async function getAllDepartmentGoals(f: DeptItemListFilter, page: number, size: number, sortBy: string) {
  const list = await listDeptItems(
    {
      table: 'DepartmentGoal',
      idColumn: 'GoalID',
      searchColumns: ['GoalName', 'GoalMetric'],
      select: `x.GoalID, x.DepartmentID, d.DepartmentName, x.GoalName, x.GoalMetric, x.MetricValue, x.Unit,
               x.Frequency, x.TimingType, x.IsDynamic, x.Description, x.CreatedAt, x.ModifiedAt, x.IsActive,
               x.LiveAccounts, x.approvedByEL, x.RoleID, d.IsDepartmentArchived`,
    },
    f, page, size, sortBy,
  );
  const goals = list.rows.map((r) => {
    const isActive = toBool(r['IsActive']);
    const isDepartmentArchived = toBool(r['IsDepartmentArchived']) === true;
    return {
      goalID: r['GoalID'],
      departmentID: r['DepartmentID'],
      departmentName: r['DepartmentName'],
      goalName: r['GoalName'],
      goalMetric: r['GoalMetric'],
      metricValue: r['MetricValue'],
      liveAccounts: r['LiveAccounts'],
      unit: r['Unit'],
      frequency: r['Frequency'],
      timingType: r['TimingType'],
      isDynamic: toBool(r['IsDynamic']),
      description: r['Description'],
      isActive,
      createdAt: toLocalDateTime(r['CreatedAt']),
      modifiedAt: toLocalDateTime(r['ModifiedAt']),
      approvedByEL: toBool(r['approvedByEL']) === true,
      roleID: r['RoleID'],
      isDepartmentArchived,
      newStatus: isActive && !isDepartmentArchived ? 'Active' : isDepartmentArchived ? 'Archived' : 'Inactive',
    };
  });
  const { rows: _rows, ...paging } = list;
  return javaOk('Department goals retrieved successfully', { goals, ...paging });
}

/** PUT /departmentGoals/approve { goalIds, userId } — only Executive Leaders (role 3) may approve */
export async function approveGoals(input: { goalIds?: number[] | null; userId?: number | null }) {
  if (input.userId == null) return javaFail(400, 'userId is required');
  if (!input.goalIds?.length) return javaFail(400, 'goalIds must not be empty');

  const [users] = await pool.query<mysql.RowDataPacket[]>('SELECT RoleID FROM Users WHERE UserID = ?', [input.userId]);
  if (!users.length) return javaFail(404, `User not found with ID: ${input.userId}`);
  if (users[0]!['RoleID'] !== 3) return javaFail(403, 'Access denied. Only EL users can approve goals.');

  const [found] = await pool.query<mysql.RowDataPacket[]>('SELECT GoalID FROM DepartmentGoal WHERE GoalID IN (?)', [input.goalIds]);
  const foundIds = new Set(found.map((g) => g['GoalID'] as number));
  const missing = input.goalIds.filter((id) => !foundIds.has(id));
  if (missing.length) return javaFail(404, `Goal(s) not found with ID(s): [${missing.join(', ')}]`);

  const [r] = await pool.query<mysql.ResultSetHeader>(
    'UPDATE DepartmentGoal SET approvedByEL = TRUE, ModifiedAt = NOW() WHERE GoalID IN (?)',
    [input.goalIds],
  );
  return javaOk('Goal(s) approved successfully', {
    approvedGoalIds: input.goalIds, approvedCount: r.affectedRows, approvedByUserId: input.userId,
  });
}
