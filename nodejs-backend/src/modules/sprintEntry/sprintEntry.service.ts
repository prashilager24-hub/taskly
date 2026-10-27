import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';

interface SprintEntryInput {
  UserID: number;
  SprintID: number;
  WorkDate: string;
  PointsCompleted: number;
  StoryID?: number;
  Notes?: string;
}

export async function createSprintEntry(input: SprintEntryInput) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO SprintEntry
       (UserID, SprintID, StoryID, WorkDate, PointsCompleted, Notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.UserID, input.SprintID, input.StoryID ?? null,
     input.WorkDate, input.PointsCompleted, input.Notes ?? null],
  );
  return findById(r.insertId);
}

export async function updateSprintEntry(id: number, input: Partial<SprintEntryInput>) {
  const allowed: Array<keyof SprintEntryInput> = ['WorkDate', 'PointsCompleted', 'Notes', 'StoryID'];
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (input[key] !== undefined) { fields.push(`${key} = ?`); values.push(input[key]); }
  }
  if (!fields.length) throw new Error('No fields to update');
  values.push(id);
  await pool.query(`UPDATE SprintEntry SET ${fields.join(', ')} WHERE EntryID = ?`, values);
  return findById(id);
}

export async function findById(id: number) {
  const [[row]] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT se.*, u.UserName, s.SprintName, st.StoryKey
     FROM SprintEntry se
     LEFT JOIN Users u ON u.UserID = se.UserID
     LEFT JOIN TechSprint s ON s.SprintID = se.SprintID
     LEFT JOIN TechStory st ON st.StoryID = se.StoryID
     WHERE se.EntryID = ?`,
    [id],
  );
  return row ?? null;
}

export async function findHistory(
  userId: number,
  sprint?: string,
  from?: string,
  to?: string,
  page = 0,
  size = 20,
) {
  const conditions = ['se.UserID = ?'];
  const params: unknown[] = [userId];
  if (sprint) { conditions.push('s.SprintName LIKE ?'); params.push(`%${sprint}%`); }
  if (from) { conditions.push('se.WorkDate >= ?'); params.push(from); }
  if (to) { conditions.push('se.WorkDate <= ?'); params.push(to); }

  const offset = page * size;
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT se.*, u.UserName, s.SprintName, st.StoryKey
     FROM SprintEntry se
     LEFT JOIN Users u ON u.UserID = se.UserID
     LEFT JOIN TechSprint s ON s.SprintID = se.SprintID
     LEFT JOIN TechStory st ON st.StoryID = se.StoryID
     WHERE ${conditions.join(' AND ')}
     ORDER BY se.WorkDate DESC
     LIMIT ? OFFSET ?`,
    [...params, size, offset],
  );
  const [[countRow]] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM SprintEntry se
     LEFT JOIN TechSprint s ON s.SprintID = se.SprintID
     WHERE ${conditions.join(' AND ')}`,
    params,
  );
  return {
    content: rows,
    totalElements: (countRow as mysql.RowDataPacket)['total'],
    page, size,
    totalPages: Math.ceil((countRow as mysql.RowDataPacket)['total'] / size),
  };
}

export async function deleteEntry(id: number) {
  await pool.execute('DELETE FROM SprintEntry WHERE EntryID = ?', [id]);
  return { message: 'Sprint entry deleted successfully' };
}

export async function patchManagerNote(id: number, managerNote: string) {
  await pool.execute('UPDATE SprintEntry SET ManagerNote = ? WHERE EntryID = ?', [managerNote, id]);
  return findById(id);
}

export async function getAllSprintLabels() {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT DISTINCT SprintName FROM TechSprint ORDER BY SprintName',
  );
  return (rows as mysql.RowDataPacket[]).map((r: mysql.RowDataPacket) => r['SprintName'] as string);
}
