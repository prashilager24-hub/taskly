import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';
import { javaFail, javaOk, nowLocalDateTime, toBool, toLocalDateTime } from '../../utils/javaCompat';

// ── Ported from Java DepartmentService + DepartmentController — response shapes match the original ──

export interface DepartmentInput {
  departmentName?: string | null;
  departmentDescription?: string | null;
  executiveLeaderID?: number | null;
  functionalLeaderID?: number | null;
  primaryDepartmentId?: number | null;
}

export interface DepartmentListFilter {
  searchText?: string | null;
  filter?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  roleID?: number | null;
  userID?: number | null;
}

const CRITERIA = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'COMBINED'];

async function exists(sql: string, params: unknown[]) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(sql, params);
  return rows.length > 0;
}

const toLocalDate = (v: unknown) => toLocalDateTime(v)?.slice(0, 10) ?? null;

// ── Department ───────────────────────────────────────────────────────────────

/** POST /Department/list — roleID 3 narrows to the user's EL departments, 4 to their FL departments */
export async function getAllDepartments(f: DepartmentListFilter, page: number, size: number) {
  const conds: string[] = [];
  const params: (string | number)[] = [];
  if (f.searchText) {
    conds.push(`(CAST(d.DepartmentID AS CHAR) LIKE CONCAT('%', ?, '%')
      OR LOWER(d.DepartmentName) LIKE LOWER(CONCAT('%', ?, '%'))
      OR LOWER(d.DepartmentDescription) LIKE LOWER(CONCAT('%', ?, '%')))`);
    params.push(f.searchText, f.searchText, f.searchText);
  }
  switch (f.filter) {
    case 'Active': conds.push('d.DepartmentStatus = TRUE'); break;
    case 'Inactive': conds.push('d.DepartmentStatus = FALSE', 'd.IsDepartmentArchived = FALSE'); break;
    case 'Archived': conds.push('d.IsDepartmentArchived = TRUE'); break;
    case 'NonArchived': conds.push('d.IsDepartmentArchived = FALSE'); break;
  }
  if (f.startDate) { conds.push('d.DepartmentCreateTime >= ?'); params.push(f.startDate); }
  if (f.endDate) { conds.push('d.DepartmentCreateTime <= ?'); params.push(f.endDate); }
  if (f.userID) {
    if (f.roleID === 3) { conds.push('d.ExecutiveLeaderID = ?'); params.push(f.userID); }
    if (f.roleID === 4) { conds.push('d.FunctionalLeaderID = ?'); params.push(f.userID); }
  }

  const from = `FROM Department d
    LEFT JOIN Users el ON el.UserID = d.ExecutiveLeaderID
    LEFT JOIN Users fl ON fl.UserID = d.FunctionalLeaderID
    LEFT JOIN PrimaryDepartment pd ON pd.PrimaryDepartmentId = d.PrimaryDepartmentId
    ${conds.length ? `WHERE ${conds.join(' AND ')}` : ''}`;
  const paged = page > 0 && size > 0;
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT d.DepartmentID, d.DepartmentName, d.DepartmentStatus, d.IsDepartmentArchived,
            d.DepartmentCreateTime, d.DepartmentModifyTime, d.DepartmentDescription,
            el.UserName AS ELName, fl.UserName AS FLName, el.UserID AS ELID, fl.UserID AS FLID,
            pd.PrimaryDepartmentId, pd.PrimaryDepartmentName
     ${from}
     ORDER BY d.DepartmentModifyTime DESC, d.DepartmentID DESC${paged ? ' LIMIT ? OFFSET ?' : ''}`,
    paged ? [...params, size, (page - 1) * size] : params,
  );

  const departments = rows.map((r) => {
    const isActive = toBool(r['DepartmentStatus']) === true;
    const isArchived = toBool(r['IsDepartmentArchived']) === true;
    return {
      departmentID: r['DepartmentID'],
      executiveLeaderID: r['ELID'] ?? null,
      functionalLeaderID: r['FLID'] ?? null,
      departmentName: r['DepartmentName'],
      executiveLeaderName: r['ELName'] ?? null,
      functionalLeaderName: r['FLName'] ?? null,
      departmentStatus: isActive,
      isDepartmentArchived: isArchived,
      departmentCreateTime: toLocalDate(r['DepartmentCreateTime']),
      departmentModifyTime: toLocalDate(r['DepartmentModifyTime']),
      departmentDescription: r['DepartmentDescription'],
      newStatus: isActive && !isArchived ? 'Active' : isArchived ? 'Archived' : 'Inactive',
      primaryDepartmentId: r['PrimaryDepartmentId'] == null ? null : Number(r['PrimaryDepartmentId']),
      primaryDepartmentName: r['PrimaryDepartmentName'] ?? null,
    };
  });

  if (!paged) {
    return javaOk('All departments retrieved successfully', {
      departments, totalRecords: departments.length, totalPages: 1, currentPage: 1, pageSize: null,
    });
  }
  const [[count]] = await pool.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS n ${from}`, params);
  const totalRecords = Number(count?.['n'] ?? 0);
  return javaOk('Departments retrieved successfully', {
    departments, totalRecords, totalPages: Math.ceil(totalRecords / size), currentPage: page, pageSize: size,
  });
}

/** POST /Department/create — needs an Executive Leader or, failing that, a Functional Leader */
export async function createDepartment(input: DepartmentInput) {
  if (await exists('SELECT 1 FROM Department WHERE DepartmentName = ?', [input.departmentName ?? null])) {
    return javaFail(409, 'Department name already exists');
  }
  // Java sets only one leader: the EL when given, otherwise the FL
  const leaderId = input.executiveLeaderID ?? input.functionalLeaderID;
  if (leaderId == null) return javaFail(500, 'Executive Leader not found with ID: missing');
  if (!(await exists('SELECT 1 FROM Users WHERE UserID = ?', [leaderId]))) {
    return javaFail(500, 'An unexpected error occurred while creating the department');
  }
  if (input.primaryDepartmentId != null &&
      !(await exists('SELECT 1 FROM PrimaryDepartment WHERE PrimaryDepartmentId = ?', [input.primaryDepartmentId]))) {
    return javaFail(500, 'An unexpected error occurred while creating the department');
  }

  const [r] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO Department
       (DepartmentName, DepartmentDescription, DepartmentCreateTime, DepartmentModifyTime,
        ExecutiveLeaderID, FunctionalLeaderID, PrimaryDepartmentId)
     VALUES (?, ?, NOW(), NOW(), ?, ?, ?)`,
    [
      input.departmentName ?? null, input.departmentDescription ?? null,
      input.executiveLeaderID ?? null, input.executiveLeaderID == null ? input.functionalLeaderID ?? null : null,
      input.primaryDepartmentId ?? null,
    ],
  );
  return javaOk('Department created successfully', {
    departmentID: r.insertId, departmentName: input.departmentName, departmentDescription: input.departmentDescription ?? null,
  });
}

/** POST /Department/update/:id — partial update */
export async function updateDepartment(id: number, input: DepartmentInput) {
  if (!(await exists('SELECT 1 FROM Department WHERE DepartmentID = ?', [id]))) return javaFail(404, 'Department not found');

  const name = input.departmentName?.trim() ? input.departmentName : null;
  if (name && (await exists('SELECT 1 FROM Department WHERE DepartmentName = ? AND DepartmentID <> ?', [name, id]))) {
    return javaFail(409, 'Another department with the same name already exists');
  }
  for (const uid of [input.executiveLeaderID, input.functionalLeaderID]) {
    if (uid != null && !(await exists('SELECT 1 FROM Users WHERE UserID = ?', [uid]))) {
      return javaFail(500, 'Unexpected error occurred while updating department');
    }
  }
  if (input.primaryDepartmentId != null &&
      !(await exists('SELECT 1 FROM PrimaryDepartment WHERE PrimaryDepartmentId = ?', [input.primaryDepartmentId]))) {
    return javaFail(500, 'Unexpected error occurred while updating department');
  }

  const sets = ['DepartmentModifyTime = NOW()'];
  const params: unknown[] = [];
  if (name) { sets.push('DepartmentName = ?'); params.push(name); }
  if (input.departmentDescription != null) { sets.push('DepartmentDescription = ?'); params.push(input.departmentDescription); }
  if (input.executiveLeaderID != null) { sets.push('ExecutiveLeaderID = ?'); params.push(input.executiveLeaderID); }
  if (input.functionalLeaderID != null) { sets.push('FunctionalLeaderID = ?'); params.push(input.functionalLeaderID); }
  if (input.primaryDepartmentId != null) { sets.push('PrimaryDepartmentId = ?'); params.push(input.primaryDepartmentId); }
  await pool.query(`UPDATE Department SET ${sets.join(', ')} WHERE DepartmentID = ?`, [...params, id]);

  const [[dept]] = await pool.query<mysql.RowDataPacket[]>('SELECT DepartmentName FROM Department WHERE DepartmentID = ?', [id]);
  return javaOk('Department updated successfully', { departmentID: id, departmentName: dept?.['DepartmentName'] });
}

async function activeUserCount(departmentId: number) {
  const [[row]] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM Users u JOIN DepartmentUser du ON du.UserID = u.UserID
     WHERE du.DepartmentID = ? AND u.UserStatus = TRUE`,
    [departmentId],
  );
  return Number(row?.['n'] ?? 0);
}

/** POST /Department/status { departmentIDList, departmentStatus } — can't deactivate a department with active users */
export async function updateDepartmentStatus(input: { departmentIDList?: number[] | null; departmentStatus?: boolean | null }) {
  const status = input.departmentStatus === true;
  for (const id of input.departmentIDList ?? []) {
    const users = await activeUserCount(id);
    if (users > 0 && !status) {
      return javaFail(400, `Department ID ${id} has ${users} active users. Please deactivate users first.`);
    }
    await pool.execute('UPDATE Department SET DepartmentStatus = ?, DepartmentModifyTime = ? WHERE DepartmentID = ?',
      [status ? 1 : 0, nowLocalDateTime().replace('T', ' '), id]);
  }
  return javaOk('Department status updated successfully');
}

/** POST /Department/archive { departmentIDList } */
export async function updateDepartmentArchive(input: { departmentIDList?: number[] | null }) {
  for (const id of input.departmentIDList ?? []) {
    if (!(await exists('SELECT 1 FROM Department WHERE DepartmentID = ?', [id]))) {
      return javaFail(404, `Department with ID ${id} not found`);
    }
    const users = await activeUserCount(id);
    if (users > 0) {
      return javaFail(409, `This department has ${users} active users. Please deactivate them before archiving.`);
    }
    await pool.execute('UPDATE Department SET IsDepartmentArchived = TRUE, DepartmentModifyTime = ? WHERE DepartmentID = ?',
      [nowLocalDateTime().replace('T', ' '), id]);
  }
  return javaOk('Department archive status updated successfully');
}

/** GET /Department/taskTarget/:departmentId — active targets and tasks; Java's { status, statusCode, result } */
export async function getDepartmentTargetsAndTasks(departmentId: number) {
  const [targets] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT TargetID, TargetName FROM DepartmentTarget WHERE DepartmentID = ? AND IsActive = TRUE', [departmentId]);
  const [tasks] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT TaskID, TaskName FROM DepartmentTask WHERE DepartmentID = ? AND IsActive = TRUE', [departmentId]);
  return {
    status: 'success',
    statusCode: 200,
    result: {
      targets: targets.map((t) => ({ targetID: t['TargetID'], targetName: t['TargetName'] })),
      tasks: tasks.map((t) => ({ taskID: t['TaskID'], taskName: t['TaskName'] })),
    },
  };
}

/** GET /Department/hierarchy — active primary departments → active departments → their active users */
export async function getDepartmentHierarchy() {
  const [primaries] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT * FROM PrimaryDepartment WHERE IsActive = TRUE ORDER BY PrimaryDepartmentName ASC');
  if (!primaries.length) return [];

  const [depts] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT d.*, el.UserName AS ELName, fl.UserName AS FLName
     FROM Department d
     LEFT JOIN Users el ON el.UserID = d.ExecutiveLeaderID
     LEFT JOIN Users fl ON fl.UserID = d.FunctionalLeaderID
     WHERE d.PrimaryDepartmentId IN (?) AND d.DepartmentStatus = TRUE AND d.IsDepartmentArchived = FALSE
     ORDER BY d.DepartmentName ASC`,
    [primaries.map((p) => p['PrimaryDepartmentId'])],
  );

  const usersByDept = new Map<number, mysql.RowDataPacket[]>();
  if (depts.length) {
    const [users] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT du.DepartmentID, u.UserID, u.UserName, u.UserEmail, u.EmployeeID, u.UserStatus, u.RoleID,
              r.RoleName, rm.UserID AS RMID, rm.UserName AS RMName
       FROM DepartmentUser du
       JOIN Users u ON u.UserID = du.UserID
       LEFT JOIN AMRole r ON r.RoleID = u.RoleID
       LEFT JOIN Users rm ON rm.UserID = u.ReportingManagerID
       WHERE du.DepartmentID IN (?) AND u.UserStatus = TRUE AND u.IsUserArchived = FALSE`,
      [depts.map((d) => d['DepartmentID'])],
    );
    for (const u of users) {
      const list = usersByDept.get(u['DepartmentID'] as number) ?? [];
      list.push(u);
      usersByDept.set(u['DepartmentID'] as number, list);
    }
  }

  // Field names follow Lombok/Jackson: boolean isActive → "active", isDepartmentArchived → "departmentArchived"
  return primaries.map((pd) => ({
    primaryDepartmentId: Number(pd['PrimaryDepartmentId']),
    primaryDepartmentName: pd['PrimaryDepartmentName'],
    type: pd['Type'],
    active: toBool(pd['IsActive']) === true,
    departments: depts
      .filter((d) => String(d['PrimaryDepartmentId']) === String(pd['PrimaryDepartmentId']))
      .map((d) => ({
        departmentID: d['DepartmentID'],
        departmentName: d['DepartmentName'],
        departmentDescription: d['DepartmentDescription'],
        departmentStatus: toBool(d['DepartmentStatus']) === true,
        departmentArchived: toBool(d['IsDepartmentArchived']) === true,
        executiveLeaderId: d['ExecutiveLeaderID'] ?? null,
        executiveLeaderName: d['ELName'] ?? null,
        functionalLeaderId: d['FunctionalLeaderID'] ?? null,
        functionalLeaderName: d['FLName'] ?? null,
        users: (usersByDept.get(d['DepartmentID'] as number) ?? []).map((u) => ({
          userID: u['UserID'],
          name: u['UserName'],
          userEmail: u['UserEmail'],
          employeeID: u['EmployeeID'],
          userStatus: toBool(u['UserStatus']),
          roleID: u['RoleID'] ?? null,
          roleName: u['RoleName'] ?? null,
          reportingManagerId: u['RMID'] ?? null,
          reportingManagerName: u['RMName'] ?? null,
        })),
      })),
  }));
}

// ── PrimaryDepartment ────────────────────────────────────────────────────────

function primaryDepartmentEntity(r: mysql.RowDataPacket) {
  return {
    primaryDepartmentId: Number(r['PrimaryDepartmentId']),
    primaryDepartmentName: r['PrimaryDepartmentName'],
    type: r['Type'],
    goalCriteria: r['GoalCriteria'],
    targetCriteria: r['TargetCriteria'],
    active: toBool(r['IsActive']) === true,
    createdAt: r['CreatedAt'] instanceof Date ? (r['CreatedAt'] as Date).toISOString() : r['CreatedAt'],
    updatedAt: r['UpdatedAt'] instanceof Date ? (r['UpdatedAt'] as Date).toISOString() : r['UpdatedAt'],
  };
}

const badCriteria = () => javaFail(400, 'Invalid criteria value. Allowed values: DAILY, WEEKLY, MONTHLY, QUARTERLY, COMBINED');
const normCriteria = (v: unknown) => (typeof v === 'string' ? v.toUpperCase() : null);

export async function listPrimaryDepartments() {
  const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM PrimaryDepartment');
  return { status: true, statusCode: 200, message: 'Primary Departments retrieved successfully', data: rows.map(primaryDepartmentEntity) };
}

export async function createPrimaryDepartment(body: Record<string, unknown>) {
  const name = typeof body['primaryDepartmentName'] === 'string' ? body['primaryDepartmentName'] : '';
  if (!name.trim()) return javaFail(400, 'PrimaryDepartmentName is required');
  if (await exists('SELECT 1 FROM PrimaryDepartment WHERE PrimaryDepartmentName = ?', [name])) {
    return javaFail(409, 'Primary Department name already exists');
  }
  const goal = 'goalCriteria' in body ? normCriteria(body['goalCriteria']) : null;
  const target = 'targetCriteria' in body ? normCriteria(body['targetCriteria']) : null;
  if (('goalCriteria' in body && !CRITERIA.includes(goal ?? '')) || ('targetCriteria' in body && !CRITERIA.includes(target ?? ''))) {
    return badCriteria();
  }

  const [r] = await pool.execute<mysql.ResultSetHeader>(
    'INSERT INTO PrimaryDepartment (PrimaryDepartmentName, Type, IsActive, GoalCriteria, TargetCriteria) VALUES (?, ?, 1, ?, ?)',
    [name, typeof body['type'] === 'string' ? body['type'] : null, goal, target],
  );
  return {
    status: true, statusCode: 200, message: 'Primary Department created successfully',
    primaryDepartmentId: r.insertId, primaryDepartmentName: name, goalCriteria: goal, targetCriteria: target,
  };
}

export async function updatePrimaryDepartment(id: number, body: Record<string, unknown>) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM PrimaryDepartment WHERE PrimaryDepartmentId = ?', [id]);
  if (!rows.length) return javaFail(404, 'Primary Department not found');

  const sets: string[] = [];
  const params: unknown[] = [];
  const name = body['primaryDepartmentName'];
  if (typeof name === 'string' && name.trim()) { sets.push('PrimaryDepartmentName = ?'); params.push(name); }
  if ('isActive' in body) { sets.push('IsActive = ?'); params.push(body['isActive'] ? 1 : 0); }
  if ('type' in body) { sets.push('Type = ?'); params.push(body['type'] ?? null); }
  for (const [key, col] of [['goalCriteria', 'GoalCriteria'], ['targetCriteria', 'TargetCriteria']] as const) {
    if (!(key in body)) continue;
    const v = normCriteria(body[key]);
    if (!CRITERIA.includes(v ?? '')) return badCriteria();
    sets.push(`${col} = ?`);
    params.push(v);
  }
  if (sets.length) {
    await pool.query(`UPDATE PrimaryDepartment SET ${sets.join(', ')}, UpdatedAt = NOW() WHERE PrimaryDepartmentId = ?`, [...params, id]);
  }

  const [[pd]] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM PrimaryDepartment WHERE PrimaryDepartmentId = ?', [id]);
  const e = primaryDepartmentEntity(pd!);
  return {
    status: true, statusCode: 200, message: 'Primary Department updated successfully',
    primaryDepartmentId: e.primaryDepartmentId, primaryDepartmentName: e.primaryDepartmentName, isActive: e.active,
    type: e.type, goalCriteria: e.goalCriteria, targetCriteria: e.targetCriteria,
  };
}

export async function updatePrimaryDepartmentStatus(body: Record<string, unknown>) {
  const id = typeof body['primaryDepartmentId'] === 'number' ? body['primaryDepartmentId'] : null;
  const isActive = typeof body['isActive'] === 'boolean' ? body['isActive'] : null;
  if (id == null || isActive == null) return javaFail(400, 'primaryDepartmentId and isActive are required');

  const [r] = await pool.execute<mysql.ResultSetHeader>(
    'UPDATE PrimaryDepartment SET IsActive = ?, UpdatedAt = NOW() WHERE PrimaryDepartmentId = ?', [isActive ? 1 : 0, id]);
  if (!r.affectedRows) return javaFail(404, 'Primary Department not found');
  return { status: true, statusCode: 200, message: 'Primary Department status updated successfully' };
}
