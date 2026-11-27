import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';

export interface OpenRoleRow extends mysql.RowDataPacket {
  id: number;
  role_id: string | null;
  title: string;
  department: string;
  location: string;
  openings: number;
  experience: string | null;
  employment_type: string;
  description: string | null;
  hiring_manager: string | null;
  status: 'OPEN' | 'ON_HOLD' | 'CLOSED';
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

function toRole(row: OpenRoleRow) {
  return {
    id: row.id,
    roleId: row.role_id ?? null,
    title: row.title,
    department: row.department,
    location: row.location,
    openings: row.openings,
    experience: row.experience ?? null,
    employmentType: row.employment_type,
    description: row.description ?? null,
    hiringManager: row.hiring_manager ?? null,
    recruiter: (row as any).recruiter ?? null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPublic() {
  const [rows] = await pool.query<OpenRoleRow[]>(
    "SELECT * FROM OpenRoles WHERE status = 'OPEN' ORDER BY created_at DESC"
  );
  return rows.map(toRole);
}

export async function listAll() {
  const [rows] = await pool.query<OpenRoleRow[]>(
    "SELECT * FROM OpenRoles ORDER BY created_at DESC"
  );
  return rows.map(toRole);
}

export async function getById(id: number) {
  const [rows] = await pool.query<OpenRoleRow[]>(
    "SELECT * FROM OpenRoles WHERE id = ?", [id]
  );
  return rows[0] ? toRole(rows[0]) : null;
}

export async function create(data: {
  title: string;
  department: string;
  location: string;
  openings: number;
  experience?: string;
  employmentType?: string;
  description?: string;
  hiringManager?: string;
  recruiter?: string;
  createdBy?: number;
}) {
  const [result] = await pool.query<mysql.ResultSetHeader>(
    `INSERT INTO OpenRoles (title, department, location, openings, experience, employment_type, description, hiring_manager, recruiter, created_by, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
    [
      data.title,
      data.department,
      data.location,
      data.openings,
      data.experience ?? null,
      data.employmentType ?? 'Full Time',
      data.description ?? null,
      data.hiringManager ?? null,
      data.recruiter ?? null,
      data.createdBy ?? null,
    ]
  );
  const roleId = `TM-${String(result.insertId).padStart(3, '0')}`;
  await pool.query(`UPDATE OpenRoles SET role_id = ? WHERE id = ?`, [roleId, result.insertId]);
  return getById(result.insertId);
}

export async function update(id: number, data: Partial<{
  title: string;
  department: string;
  location: string;
  openings: number;
  experience: string;
  employmentType: string;
  description: string;
  hiringManager: string;
  recruiter: string;
  status: 'OPEN' | 'ON_HOLD' | 'CLOSED';
}>) {
  const sets: string[] = [];
  const vals: unknown[] = [];

  if (data.title !== undefined) { sets.push('title = ?'); vals.push(data.title); }
  if (data.department !== undefined) { sets.push('department = ?'); vals.push(data.department); }
  if (data.location !== undefined) { sets.push('location = ?'); vals.push(data.location); }
  if (data.openings !== undefined) { sets.push('openings = ?'); vals.push(data.openings); }
  if (data.experience !== undefined) { sets.push('experience = ?'); vals.push(data.experience); }
  if (data.employmentType !== undefined) { sets.push('employment_type = ?'); vals.push(data.employmentType); }
  if (data.description !== undefined) { sets.push('description = ?'); vals.push(data.description); }
  if (data.hiringManager !== undefined) { sets.push('hiring_manager = ?'); vals.push(data.hiringManager); }
  if (data.recruiter !== undefined) { sets.push('recruiter = ?'); vals.push(data.recruiter); }
  if (data.status !== undefined) { sets.push('status = ?'); vals.push(data.status); }

  if (!sets.length) return getById(id);
  vals.push(id);
  await pool.query(`UPDATE OpenRoles SET ${sets.join(', ')} WHERE id = ?`, vals);
  return getById(id);
}

export async function remove(id: number) {
  await pool.query("DELETE FROM OpenRoles WHERE id = ?", [id]);
}
