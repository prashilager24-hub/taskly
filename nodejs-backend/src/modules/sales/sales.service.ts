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
export type TamStatus = 'LIVE' | 'NOT_LIVE';
// account_id is a BIGINT, which mysql2 returns as a string: send it as a number
const asTam = (r: mysql.RowDataPacket | undefined) => (r ? { ...r, accountId: Number(r['accountId']) } : r);
const TAM_COLS = `account_id AS accountId, publisher_name AS publisherName, status,
  DATE_FORMAT(entry_date, '%Y-%m-%d') AS entryDate, DATE_FORMAT(live_date, '%Y-%m-%d') AS liveDate`;

/** One page of tam_accounts (page starts at 1), in the shape DailyActivityLog reads */
export async function getTAMAccounts(opts: { page: number; size: number; status?: string }) {
  const status = opts.status === 'LIVE' || opts.status === 'NOT_LIVE' ? opts.status : null;
  const where = status ? 'WHERE status = ?' : '';
  const params: (string | number)[] = status ? [status] : [];
  const [[{ total }]] = await pool.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS total FROM tam_accounts ${where}`, params);
  const totalItems = Number(total);
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT ${TAM_COLS} FROM tam_accounts ${where} ORDER BY created_at DESC, account_id DESC LIMIT ? OFFSET ?`,
    [...params, opts.size, (opts.page - 1) * opts.size],
  );
  return { data: rows.map(asTam), totalItems, totalPages: Math.ceil(totalItems / opts.size), currentPage: opts.page };
}

export async function rescheduleTACall(input: {
  CallID: number;
  NewDatetime: string;
  Reason: string;
  UserID: number;
}) {
  await pool.execute(
    `UPDATE TACall SET ScheduledDatetime = ?, RescheduleReason = ?,
     Status = 'RESCHEDULED', UpdatedBy = ? WHERE CallID = ?`,
    [input.NewDatetime, input.Reason, input.UserID, input.CallID],
  );
  const [[row]] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT * FROM TACall WHERE CallID = ?', [input.CallID],
  );
  return row ?? null;
}

export async function createTAMAccount(input: { publisherName: string; status: TamStatus; entryDate: string; userId: number }) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO tam_accounts (publisher_name, status, entry_date, live_date, created_by_user_id, created_at, updated_at)
     VALUES (?, ?, ?, ${input.status === 'LIVE' ? 'CURDATE()' : 'NULL'}, ?, NOW(), NOW())`,
    [input.publisherName.trim(), input.status, input.entryDate, input.userId],
  );
  const [[row]] = await pool.execute<mysql.RowDataPacket[]>(`SELECT ${TAM_COLS} FROM tam_accounts WHERE account_id = ?`, [r.insertId]);
  return asTam(row);
}

export async function updateTAMAccount(input: { accountId: number; publisherName?: string; status?: TamStatus; userId: number }) {
  const fields = ['updated_by_user_id = ?', 'updated_at = NOW()'];
  const values: (string | number)[] = [input.userId];
  if (input.publisherName !== undefined) { fields.push('publisher_name = ?'); values.push(input.publisherName.trim()); }
  if (input.status !== undefined) {
    fields.push('status = ?'); values.push(input.status);
    // the first time it goes live keeps its date; back to not live clears it
    fields.push(input.status === 'LIVE' ? 'live_date = COALESCE(live_date, CURDATE())' : 'live_date = NULL');
  }
  values.push(input.accountId);
  const [r] = await pool.execute<mysql.ResultSetHeader>(`UPDATE tam_accounts SET ${fields.join(', ')} WHERE account_id = ?`, values);
  if (!r.affectedRows) throw new AppError('TAM account not found', 404);
  const [[row]] = await pool.execute<mysql.RowDataPacket[]>(`SELECT ${TAM_COLS} FROM tam_accounts WHERE account_id = ?`, [input.accountId]);
  return asTam(row);
}
