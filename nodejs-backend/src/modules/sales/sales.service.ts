import { pool } from '../../config/db';
import { AppError } from '../../utils/AppError';
import type mysql from 'mysql2/promise';

// ── Sales Calls ───────────────────────────────────────────────────────────────
export async function getSalesCalls(filters: { SalesUserID?: number; status?: string; fromDate?: string; toDate?: string }) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (filters.SalesUserID) { conditions.push('sc.SalesUserID = ?'); params.push(filters.SalesUserID); }
  if (filters.status) { conditions.push('sc.status = ?'); params.push(filters.status); }
  if (filters.fromDate && filters.toDate) {
    conditions.push('DATE(sc.ScheduledDatetime) BETWEEN ? AND ?');
    params.push(filters.fromDate, filters.toDate);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT sc.*, u.UserName AS SalesUserName
     FROM SalesCallSchedule sc LEFT JOIN Users u ON u.UserID = sc.SalesUserID
     ${where} ORDER BY sc.ScheduledDatetime DESC`,
    params,
  );
  return rows;
}

export async function scheduleSalesCall(input: {
  CreaterUserID: number; PublisherName: string; SalesUserID: number;
  ScheduledDatetime: string;
}) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO SalesCallSchedule (CreaterUserID, PublisherName, SalesUserID, ScheduledDatetime, status)
     VALUES (?, ?, ?, ?, 'SCHEDULED')`,
    [input.CreaterUserID, input.PublisherName, input.SalesUserID, input.ScheduledDatetime],
  );
  return { CallID: r.insertId, message: 'Sales call scheduled' };
}

export async function updateSalesCallStatus(callId: number, status: string) {
  await pool.execute('UPDATE SalesCallSchedule SET status = ? WHERE CallID = ?', [status, callId]);
  return { message: 'Sales call status updated' };
}

export async function rescheduleSalesCall(input: { CallID: number; NewDatetime: string; Reason: string; UserID: number }) {
  const [call] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT * FROM SalesCallSchedule WHERE CallID = ? LIMIT 1', [input.CallID],
  );
  if (!call.length) throw AppError.notFound('Sales call not found');

  await pool.execute(
    'INSERT INTO Salescallreschedulelog (CallID, OldDatetime, NewDatetime, Reason, RescheduledBy) VALUES (?, ?, ?, ?, ?)',
    [input.CallID, (call[0] as { ScheduledDatetime: string }).ScheduledDatetime, input.NewDatetime, input.Reason, input.UserID],
  );
  await pool.execute(
    "UPDATE SalesCallSchedule SET ScheduledDatetime = ?, status = 'RESCHEDULED' WHERE CallID = ?",
    [input.NewDatetime, input.CallID],
  );
  return { message: 'Sales call rescheduled' };
}

// ── TA Calls ──────────────────────────────────────────────────────────────────
export async function getTACalls(filters: { TAUserID?: number; Status?: string }) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (filters.TAUserID) { conditions.push('tc.TAUserID = ?'); params.push(filters.TAUserID); }
  if (filters.Status) { conditions.push('tc.Status = ?'); params.push(filters.Status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT tc.*, u.UserName AS TAUserName, jp.PositionName
     FROM TACallSchedule tc
     LEFT JOIN Users u ON u.UserID = tc.TAUserID
     LEFT JOIN JobPositions jp ON jp.PositionID = tc.PositionID
     ${where} ORDER BY tc.ScheduledDatetime DESC`,
    params,
  );
  return rows;
}

export async function scheduleTACall(input: {
  TAUserID: number; CandidateName: string; PositionID: number; ScheduledDatetime: string;
}) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO TACallSchedule (TAUserID, CandidateName, PositionID, ScheduledDatetime, Status)
     VALUES (?, ?, ?, ?, 'SCHEDULED')`,
    [input.TAUserID, input.CandidateName, input.PositionID, input.ScheduledDatetime],
  );
  return { CallID: r.insertId, message: 'TA call scheduled' };
}

export async function updateTACallStatus(callId: number, status: string) {
  await pool.execute('UPDATE TACallSchedule SET Status = ? WHERE CallID = ?', [status, callId]);
  return { message: 'TA call status updated' };
}

// ── TAM Accounts ──────────────────────────────────────────────────────────────
export async function getTAMAccounts(status?: string) {
  const where = status ? 'WHERE status = ?' : '';
  const params = status ? [status] : [];
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT * FROM tam_accounts ${where} ORDER BY created_at DESC`, params,
  );
  return rows;
}
