import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';

export interface LogRow extends mysql.RowDataPacket {
  id: number;
  entity_type: 'OPEN_ROLE' | 'APPLICATION';
  entity_id: number;
  action: string;
  details: string | null;
  actor: string;
  created_at: Date;
}

export async function addLog(
  entityType: 'OPEN_ROLE' | 'APPLICATION',
  entityId: number,
  action: string,
  details: string | null,
  actor: string,
) {
  await pool.query(
    `INSERT INTO TalentActivityLogs (entity_type, entity_id, action, details, actor) VALUES (?, ?, ?, ?, ?)`,
    [entityType, entityId, action, details ?? null, actor],
  );
}

export async function getRecentAll(limit = 60) {
  const [rows] = await pool.query<LogRow[]>(
    `SELECT * FROM TalentActivityLogs ORDER BY created_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(r => ({
    id: r.id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    action: r.action,
    details: r.details ?? null,
    actor: r.actor,
    createdAt: r.created_at,
  }));
}

export async function getLogs(entityType: 'OPEN_ROLE' | 'APPLICATION', entityId: number) {
  const [rows] = await pool.query<LogRow[]>(
    `SELECT * FROM TalentActivityLogs WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC`,
    [entityType, entityId],
  );
  return rows.map(r => ({
    id: r.id,
    action: r.action,
    details: r.details ?? null,
    actor: r.actor,
    createdAt: r.created_at,
  }));
}
