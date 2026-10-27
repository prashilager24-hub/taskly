import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';
import { javaFail, javaOk, nowLocalDateTime, toBool, toLocalDateTime } from '../../utils/javaCompat';
import { departmentExists, listDeptItems, type DeptItemListFilter } from '../../utils/deptItemList';

// ── Ported from Java DepartmentTargetService — response shapes match the original ──
// A target's roles live in DepartmentTargetRole; DepartmentTarget.RoleID holds the first of them.

export interface TargetInput {
  departmentID?: number | null;
  targetName?: string | null;
  targetMetric?: string | null;
  metricValue?: string | null;
  unit?: string | null;
  frequency?: string | null;
  timingType?: string | null;
  isDynamic?: boolean | null;
  description?: string | null;
  isActive?: boolean | null;
  roleID?: number | null;
  roleIds?: number[] | null;
}

const bit = (v: boolean | null | undefined) => (v == null ? null : v ? 1 : 0);

function rolesOf(input: TargetInput): number[] {
  if (input.roleIds?.length) return [...new Set(input.roleIds)];
  return input.roleID != null ? [input.roleID] : [];
}

async function replaceTargetRoles(conn: mysql.PoolConnection, targetId: number, roles: number[]) {
  await conn.execute('DELETE FROM DepartmentTargetRole WHERE TargetID = ?', [targetId]);
  if (roles.length) {
    await conn.query('INSERT INTO DepartmentTargetRole (TargetID, RoleID) VALUES ?', [roles.map((r) => [targetId, r])]);
  }
}

async function roleIdsByTarget(targetIds: number[]) {
  const map = new Map<number, number[]>();
  if (!targetIds.length) return map;
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT TargetID, RoleID FROM DepartmentTargetRole WHERE TargetID IN (?)',
    [targetIds],
  );
  for (const r of rows) {
    const list = map.get(r['TargetID'] as number) ?? [];
    list.push(r['RoleID'] as number);
    map.set(r['TargetID'] as number, list);
  }
  return map;
}

/** Dept 45's targets are reported as % of today's achieved units in depts 36 + 46 (Java special case) */
async function dept36And46AchievedUnitsToday() {
  const [[row]] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COALESCE(SUM(AchivedUnits), 0) AS s FROM UserWorkData
     WHERE DepartmentID IN (36, 46) AND IsForTarget = TRUE AND WorkDate = CURDATE()`,
  );
  // Java summed into an Integer
  return Math.trunc(Number(row?.['s'] ?? 0));
}

function percentOf(achieved: number, metricValue: unknown): string {
  const target = Number.parseFloat(String(metricValue));
  if (Number.isNaN(target)) return '0';
  if (target <= 0) return '0';
  return String(Math.round((achieved / target) * 10000) / 100);
}

export async function createDepartmentTarget(input: TargetInput) {
  if (!input.departmentID || !(await departmentExists(input.departmentID))) return javaFail(404, 'Department not found');
  const roles = rolesOf(input);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO DepartmentTarget
         (DepartmentID, TargetName, TargetMetric, MetricValue, Unit, Frequency, TimingType, IsDynamic,
          Description, IsActive, RoleID)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        input.departmentID, input.targetName ?? null, input.targetMetric ?? '', input.metricValue ?? null,
        input.unit ?? null, input.frequency ?? 'Daily', input.timingType ?? null, bit(input.isDynamic) ?? 0,
        input.description ?? null, roles[0] ?? null,
      ],
    );
    await replaceTargetRoles(conn, r.insertId, roles);
    await conn.commit();
    return javaOk('Department target created successfully', {
      targetID: r.insertId, targetMetric: input.targetMetric, departmentID: input.departmentID,
    });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** Like Java, every field is overwritten from the request */
export async function updateDepartmentTarget(targetId: number, input: TargetInput) {
  const [existing] = await pool.query<mysql.RowDataPacket[]>('SELECT DepartmentID FROM DepartmentTarget WHERE TargetID = ?', [targetId]);
  if (!existing.length) return javaFail(404, `Target not found with ID: ${targetId}`);
  if (input.departmentID != null && !(await departmentExists(input.departmentID))) return javaFail(404, 'Department not found');

  const roles = rolesOf(input);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE DepartmentTarget SET DepartmentID = ?, TargetName = ?, TargetMetric = ?, MetricValue = ?, Unit = ?,
         Frequency = ?, TimingType = ?, IsDynamic = ?, Description = ?, IsActive = ?, RoleID = ?, ModifiedAt = NOW()
       WHERE TargetID = ?`,
      [
        input.departmentID ?? existing[0]!['DepartmentID'], input.targetName ?? null, input.targetMetric ?? '',
        input.metricValue ?? null, input.unit ?? null, input.frequency ?? null, input.timingType ?? null,
        bit(input.isDynamic), input.description ?? null, bit(input.isActive), roles[0] ?? null, targetId,
      ],
    );
    await replaceTargetRoles(conn, targetId, roles);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return javaOk('Department target updated successfully', {
    targetID: targetId, targetMetric: input.targetMetric, updatedAt: nowLocalDateTime(),
  });
}

export async function updateDepartmentTargetStatus(targetId: number, isActive: boolean) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT TargetMetric FROM DepartmentTarget WHERE TargetID = ?', [targetId]);
  if (!rows.length) return javaFail(404, `Target not found with ID: ${targetId}`);
  await pool.execute('UPDATE DepartmentTarget SET IsActive = ?, ModifiedAt = NOW() WHERE TargetID = ?', [isActive ? 1 : 0, targetId]);
  return javaOk('Target status updated successfully', {
    targetID: targetId,
    targetMetric: rows[0]!['TargetMetric'],
    status: isActive ? 'Active' : 'Inactive',
    updatedAt: nowLocalDateTime(),
  });
}

/** POST /departmentTargets/getTargetsByDepartment — Java's { status, statusCode, result } */
export async function getTargetsByDepartmentId(departmentId: number, roleId: number) {
  const params: number[] = [departmentId];
  let roleFilter = '';
  if (roleId > 0) {
    roleFilter = 'AND EXISTS (SELECT 1 FROM DepartmentTargetRole r WHERE r.TargetID = t.TargetID AND r.RoleID = ?)';
    params.push(roleId);
  }
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT t.* FROM DepartmentTarget t WHERE t.DepartmentID = ? AND t.IsActive = TRUE ${roleFilter}`,
    params,
  );
  if (!rows.length) {
    return { status: 'error', statusCode: 404, result: `No targets found for DepartmentID: ${departmentId}` };
  }

  const achievedToday = departmentId === 45 ? await dept36And46AchievedUnitsToday() : null;
  const roleMap = await roleIdsByTarget(rows.map((r) => r['TargetID'] as number));
  const result = rows.map((t) => ({
    targetID: t['TargetID'],
    targetName: t['TargetName'],
    targetMetric: t['TargetMetric'],
    metricValue: t['MetricValue'],
    unit: t['Unit'],
    frequency: t['Frequency'],
    timingType: t['TimingType'],
    isDynamic: toBool(t['IsDynamic']),
    description: t['Description'],
    isActive: toBool(t['IsActive']),
    roleID: t['RoleID'],
    roleIds: roleMap.get(t['TargetID'] as number) ?? [],
    createdAt: toLocalDateTime(t['CreatedAt']),
    modifiedAt: toLocalDateTime(t['ModifiedAt']),
    ...(achievedToday !== null ? { achievedUnit: percentOf(achievedToday, t['MetricValue']) } : {}),
  }));
  return { status: 'success', statusCode: 200, result };
}

/** POST /departmentTargets/list?page=&size=&sortBy= */
export async function getAllDepartmentTargets(f: DeptItemListFilter, page: number, size: number, sortBy: string) {
  const list = await listDeptItems(
    {
      table: 'DepartmentTarget',
      idColumn: 'TargetID',
      searchColumns: ['TargetName', 'TargetMetric'],
      select: `x.TargetID, x.DepartmentID, x.TargetName, x.TargetMetric, x.MetricValue, x.Unit, x.Frequency,
               x.TimingType, x.IsDynamic, x.Description, x.CreatedAt, x.ModifiedAt, x.IsActive, x.RoleID`,
    },
    { ...f, searchText: f.searchText?.trim() || null },
    page, size, sortBy,
  );

  const roleMap = await roleIdsByTarget(list.rows.map((r) => r['TargetID'] as number));
  const achievedToday = list.rows.some((r) => r['DepartmentID'] === 45) ? await dept36And46AchievedUnitsToday() : 0;
  const targets = list.rows.map((r) => ({
    targetID: r['TargetID'],
    departmentID: r['DepartmentID'],
    targetName: r['TargetName'],
    targetMetric: r['TargetMetric'],
    metricValue: r['DepartmentID'] === 45 ? percentOf(achievedToday, r['MetricValue']) : r['MetricValue'],
    unit: r['Unit'],
    frequency: r['Frequency'],
    timingType: r['TimingType'],
    isDynamic: toBool(r['IsDynamic']),
    description: r['Description'],
    isActive: toBool(r['IsActive']),
    createdAt: toLocalDateTime(r['CreatedAt']),
    modifiedAt: toLocalDateTime(r['ModifiedAt']),
    roleID: r['RoleID'],
    roleIds: roleMap.get(r['TargetID'] as number) ?? [],
  }));
  const { rows: _rows, ...paging } = list;
  const message = page > 0 && size > 0 ? 'Department targets retrieved successfully' : 'All department targets retrieved successfully';
  return javaOk(message, { targets, ...paging, pageSize: paging.pageSize ?? 0 });
}
