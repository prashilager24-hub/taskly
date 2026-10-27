import { pool } from '../../config/db';
import { AppError } from '../../utils/AppError';
import type mysql from 'mysql2/promise';

// ── Admin Tasks (internal tickets / action items) ─────────────────────────────
export async function getAdminTasks(filters: { status?: string; assigned_to?: number; created_by?: number }) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (filters.status) { conditions.push('at.status = ?'); params.push(filters.status); }
  if (filters.assigned_to) { conditions.push('at.assigned_to = ?'); params.push(filters.assigned_to); }
  if (filters.created_by) { conditions.push('at.created_by = ?'); params.push(filters.created_by); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT at.*,
            u1.UserName AS CreatedByName,
            u2.UserName AS AssignedToName
     FROM AdminTasks at
     LEFT JOIN Users u1 ON u1.UserID = at.created_by
     LEFT JOIN Users u2 ON u2.UserID = at.assigned_to
     ${where} ORDER BY at.created_at DESC`,
    params,
  );
  return rows;
}

export async function getAdminTaskById(taskId: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT at.*,
            u1.UserName AS CreatedByName,
            u2.UserName AS AssignedToName
     FROM AdminTasks at
     LEFT JOIN Users u1 ON u1.UserID = at.created_by
     LEFT JOIN Users u2 ON u2.UserID = at.assigned_to
     WHERE at.id = ?`,
    [taskId],
  );
  if (!rows.length) throw AppError.notFound('Admin task not found');
  return rows[0];
}

export async function createAdminTask(input: {
  title: string;
  description?: string;
  created_by: number;
  assigned_to?: number;
  priority?: string;
  due_date?: string;
}) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO AdminTasks (title, description, created_by, assigned_to, priority, due_date, status)
     VALUES (?, ?, ?, ?, ?, ?, 'OPEN')`,
    [
      input.title,
      input.description ?? null,
      input.created_by,
      input.assigned_to ?? null,
      input.priority ?? 'MEDIUM',
      input.due_date ?? null,
    ],
  );
  return { id: r.insertId, message: 'Admin task created' };
}

export async function updateAdminTask(input: {
  id: number;
  title?: string;
  description?: string;
  assigned_to?: number;
  priority?: string;
  due_date?: string;
  status?: string;
}) {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.title !== undefined) { sets.push('title = ?'); values.push(input.title); }
  if (input.description !== undefined) { sets.push('description = ?'); values.push(input.description); }
  if (input.assigned_to !== undefined) { sets.push('assigned_to = ?'); values.push(input.assigned_to); }
  if (input.priority !== undefined) { sets.push('priority = ?'); values.push(input.priority); }
  if (input.due_date !== undefined) { sets.push('due_date = ?'); values.push(input.due_date); }
  if (input.status !== undefined) { sets.push('status = ?'); values.push(input.status); }

  if (!sets.length) throw AppError.badRequest('No fields to update');
  values.push(input.id);

  await pool.execute(`UPDATE AdminTasks SET ${sets.join(', ')} WHERE id = ?`, values as string[]);
  return { message: 'Admin task updated' };
}

export async function deleteAdminTask(taskId: number) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    'DELETE FROM AdminTasks WHERE id = ?', [taskId],
  );
  if (!r.affectedRows) throw AppError.notFound('Admin task not found');
  return { message: 'Admin task deleted' };
}

// ── Job Positions ──────────────────────────────────────────────────────────────
export async function deleteJobPosition(positionId: number) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    'DELETE FROM JobPositions WHERE PositionID = ?', [positionId],
  );
  if (!r.affectedRows) throw AppError.notFound('Job position not found');
  return { message: 'Job position deleted' };
}

// ── System / Audit ────────────────────────────────────────────────────────────
export async function getAuditLogs(filters: { userId?: number; action?: string; limit?: number }) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (filters.userId) { conditions.push('al.user_id = ?'); params.push(filters.userId); }
  if (filters.action) { conditions.push('al.action LIKE ?'); params.push(`%${filters.action}%`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit ?? 100;
  params.push(limit);

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT al.*, u.UserName FROM audit_logs al
     LEFT JOIN Users u ON u.UserID = al.user_id
     ${where} ORDER BY al.created_at DESC LIMIT ?`,
    params,
  );
  return rows;
}
