import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';
import { AppError } from '../../utils/AppError';
import { toLocalDateTime } from '../../utils/javaCompat';

// ── Ported from Java JobPositionService (/positions) — response shapes match the original ──
// Recruiting positions; closing or pausing one logs HR goal 33 (dept 22) for the user:
// fixed 40 days vs the days the position was open.

const STATUSES = ['OPEN', 'CLOSED', 'PAUSED'] as const;
type PositionStatus = (typeof STATUSES)[number];

const SORTABLE: Record<string, string> = {
  positionID: 'PositionID', positionName: 'PositionName', status: 'Status', createdAt: 'CreatedAt',
  updatedAt: 'UpdatedAt', openDate: 'OpenDate', closeDate: 'CloseDate', pausedDate: 'PausedDate',
};

const localDate = (v: unknown) => toLocalDateTime(v)?.slice(0, 10) ?? null;
/** java.sql.Timestamp.toString(): "yyyy-mm-dd hh:mm:ss.f" */
const timestampString = (v: unknown) => {
  const s = toLocalDateTime(v);
  return s ? `${s.replace('T', ' ')}.0` : null;
};
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const today = () => toLocalDateTime(new Date(Date.now() - new Date().getTimezoneOffset() * 60_000))!.slice(0, 10);

function parseStatus(raw: string): PositionStatus {
  const s = raw.toUpperCase();
  if (!(STATUSES as readonly string[]).includes(s)) throw new AppError(`No enum constant PositionStatus.${s}`, 500);
  return s as PositionStatus;
}

/** "dd-MM-yyyy" (Java @JsonFormat on the request DTOs) → "yyyy-MM-dd" */
export function parseDmy(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v);
  if (!m) throw AppError.badRequest(`Invalid date "${v}", expected dd-MM-yyyy`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function toResponse(p: mysql.RowDataPacket) {
  const status = p['Status'] as PositionStatus;
  const openDate = localDate(p['OpenDate']);
  const closeDate = localDate(p['CloseDate']);
  const pausedDate = localDate(p['PausedDate']);
  let workedDays: number | null = null;
  // Java: 0 for open positions; for closed/paused, unset (null) unless both dates exist
  let achievedPerct: number | null = 0;
  if (status === 'CLOSED' || status === 'PAUSED') {
    const end = status === 'CLOSED' ? closeDate : pausedDate;
    achievedPerct = null;
    if (openDate && end) {
      workedDays = daysBetween(openDate, end);
      // 100% within 40 days, then −10% per full 10 days over
      achievedPerct = workedDays < 40 ? 100 : Math.max(100 - Math.floor((workedDays - 40) / 10) * 10, 0);
    }
  }
  return {
    positionID: Number(p['PositionID']),
    positionName: p['PositionName'],
    jdDetails: p['JD_Details'],
    status,
    createdAt: timestampString(p['CreatedAt']),
    updatedAt: timestampString(p['UpdatedAt']),
    createdByUserID: p['CreatedByUserID'],
    closedByUserID: p['ClosedByUserID'] ?? null,
    closeDate,
    openDate,
    achievedPerct,
    pausedDate,
    workedDays,
  };
}

export async function createPosition(input: { positionName?: string | null; jdDetails?: string | null; userID?: number | null; openDate?: string | null }) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO JobPositions (PositionName, JD_Details, Status, CreatedByUserID, OpenDate, CreatedAt, UpdatedAt)
     VALUES (?, ?, 'OPEN', ?, ?, NOW(), NOW())`,
    [input.positionName ?? null, input.jdDetails ?? null, input.userID ?? null, parseDmy(input.openDate)],
  );
  const [[row]] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM JobPositions WHERE PositionID = ?', [r.insertId]);
  return toResponse(row!);
}

/** GET /positions/list?page=0&size=0 — the user's own positions, unpaged */
export async function listForUser(userId: number, statusFilter: string) {
  const params: (string | number)[] = [userId];
  let statusCond = '';
  if (statusFilter.toLowerCase() !== 'all') { statusCond = 'AND Status = ?'; params.push(parseStatus(statusFilter)); }
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT * FROM JobPositions WHERE CreatedByUserID = ? ${statusCond}`, params);
  return rows.map(toResponse);
}

/** GET /positions/list?page=&size= — all positions, paged (Java ignores userId here) */
export async function listPaged(page: number, size: number, sortBy: string, sortDirection: string, statusFilter: string) {
  const column = SORTABLE[sortBy];
  if (!column) throw new AppError(`No property '${sortBy}' found for type 'JobPosition'`, 500);
  const dir = sortDirection.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  const params: (string | number)[] = [];
  let where = '';
  if (statusFilter.toLowerCase() !== 'all') { where = 'WHERE Status = ?'; params.push(parseStatus(statusFilter)); }

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT * FROM JobPositions ${where} ORDER BY ${column} ${dir} LIMIT ? OFFSET ?`,
    [...params, size, (page - 1) * size],
  );
  const [[count]] = await pool.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS n FROM JobPositions ${where}`, params);
  const totalItems = Number(count?.['n'] ?? 0);
  return {
    data: rows.map(toResponse),
    currentPage: page,
    totalItems,
    totalPages: Math.ceil(totalItems / size),
    sortBy,
    sortDirection,
    statusFilter,
  };
}

export async function updatePosition(input: {
  positionID?: number | null; positionName?: string | null; jdDetails?: string | null; status?: string | null;
  userID?: number | null; openDate?: string | null;
}) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM JobPositions WHERE PositionID = ?', [input.positionID ?? null]);
  if (!rows.length) throw new AppError('Position not found', 500);
  const old = rows[0]!['Status'] as PositionStatus;
  const next = input.status ? parseStatus(input.status) : null;

  const sets = ['UpdatedAt = NOW()'];
  const params: unknown[] = [];
  if (input.positionName != null) { sets.push('PositionName = ?'); params.push(input.positionName); }
  if (input.jdDetails != null) { sets.push('JD_Details = ?'); params.push(input.jdDetails); }
  if (next) {
    if (next === 'CLOSED' && old !== 'CLOSED') {
      sets.push('CloseDate = CURDATE()', 'ClosedByUserID = ?');
      params.push(input.userID ?? null);
    }
    if (next === 'PAUSED' && old !== 'PAUSED') {
      sets.push('PausedDate = CURDATE()', 'ClosedByUserID = ?');
      params.push(input.userID ?? null);
    }
    if (next === 'OPEN') sets.push('CloseDate = NULL', 'ClosedByUserID = NULL');
    sets.push('Status = ?');
    params.push(next);
  }
  await pool.query(`UPDATE JobPositions SET ${sets.join(', ')} WHERE PositionID = ?`, [...params, input.positionID]);

  if ((next === 'CLOSED' && old !== 'CLOSED') || (next === 'PAUSED' && old !== 'PAUSED')) {
    const openDate = parseDmy(input.openDate);
    if (!openDate) throw new AppError('openDate is required when closing or pausing a position', 500);
    await pool.execute(
      `INSERT INTO UserGoalData (GoalID, DepartmentID, UserID, WorkDate, FixedGoal, AchievedGoal)
       VALUES (33, 22, ?, CURDATE(), 40, ?)`,
      [input.userID ?? null, daysBetween(openDate, today())],
    );
  }

  const [[row]] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM JobPositions WHERE PositionID = ?', [input.positionID]);
  return toResponse(row!);
}
