import { pool } from '../config/db';
import type mysql from 'mysql2/promise';

// Shared by the Java-ported /departmentTasks, /departmentGoals and /departmentTargets
// list endpoints, which all filter the same way:
// searchText (LIKE on name columns), filter Active/Inactive, CreatedAt date range,
// ORDER BY ModifiedAt or id DESC, and page/size where page <= 0 or size <= 0 means "everything".

export interface DeptItemListFilter {
  searchText?: string | null;
  filter?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface DeptItemListSpec {
  select: string;        // columns, table alias `x`, department alias `d`
  table: string;         // e.g. DepartmentGoal
  idColumn: string;      // e.g. GoalID
  searchColumns: string[];
}

export async function listDeptItems(spec: DeptItemListSpec, f: DeptItemListFilter, page: number, size: number, sortBy: string) {
  const conds: string[] = [];
  const params: (string | number)[] = [];
  if (f.searchText) {
    conds.push(`(${spec.searchColumns.map((c) => `x.${c} LIKE CONCAT('%', ?, '%')`).join(' OR ')})`);
    spec.searchColumns.forEach(() => params.push(f.searchText!));
  }
  if (f.filter === 'Active') conds.push('x.IsActive = TRUE');
  if (f.filter === 'Inactive') conds.push('x.IsActive = FALSE');
  if (f.startDate) { conds.push('x.CreatedAt >= ?'); params.push(f.startDate); }
  if (f.endDate) { conds.push('x.CreatedAt <= ?'); params.push(f.endDate); }

  const from = `FROM ${spec.table} x JOIN Department d ON x.DepartmentID = d.DepartmentID
    ${conds.length ? `WHERE ${conds.join(' AND ')}` : ''}`;
  const orderBy = sortBy.toLowerCase() === 'modifiedat' ? 'x.ModifiedAt DESC' : `x.${spec.idColumn} DESC`;
  const paged = page > 0 && size > 0;

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT ${spec.select} ${from} ORDER BY ${orderBy}${paged ? ' LIMIT ? OFFSET ?' : ''}`,
    paged ? [...params, size, (page - 1) * size] : params,
  );
  if (!paged) return { rows, totalRecords: rows.length, totalPages: 1, currentPage: 1, pageSize: null };

  const [[count]] = await pool.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS n ${from}`, params);
  const totalRecords = Number(count?.['n'] ?? 0);
  return { rows, totalRecords, totalPages: Math.ceil(totalRecords / size), currentPage: page, pageSize: size };
}

export async function departmentExists(id: number) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT 1 FROM Department WHERE DepartmentID = ?', [id]);
  return rows.length > 0;
}
