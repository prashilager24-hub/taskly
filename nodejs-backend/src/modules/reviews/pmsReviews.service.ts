/**
 * PMS reviews — ports of the Java QuarterlyReviewService, MonthlyReviewServiceImpl and
 * UserGoalDataService.getReviewStatusSummary. The frontend reads these as plain camelCase JSON
 * (arrays / DTOs, not the { success, response } envelope), so the shapes below follow the Java DTOs.
 */
import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { AppError } from '../../utils/AppError';

type Row = mysql.RowDataPacket;

const toNum = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const day = (v: unknown): string | null => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : null);
const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
const jsonText = (v: unknown): string => JSON.stringify(v === undefined ? null : v); // Java wrote "null" for missing JSON
const parseJson = (v: unknown, fallback: unknown) => {
  if (typeof v !== 'string' || !v) return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
};

// ── Quarterly ────────────────────────────────────────────────────────────────

export interface QuarterlyBody {
  empId?: number; quarter?: string; quarterYear?: number; quarterStartDate?: string; quarterEndDate?: string;
  grade?: unknown; targetPercent?: number; goalAchievement?: number; utilizationPercent?: number; efficiencyPercent?: number;
  efficiencyLabel?: string; systemGrade?: number; managerAvgRating?: number; finalRating?: number;
  managerRatings?: unknown; feedback?: unknown; status?: string; submittedAt?: number;
}

function quarterlyDto(r: Row, dept: Map<number, string>) {
  return {
    id: r['id'], empId: r['emp_id'], employeeName: r['UserName'] ?? null, employeeEmail: r['UserEmail'] ?? null,
    departmentName: dept.get(r['emp_id'] as number) ?? null,
    quarter: r['quarter'], grade: r['grade'] ?? null, quarterYear: toNum(r['quarter_year']),
    quarterStartDate: day(r['quarter_start_date']), quarterEndDate: day(r['quarter_end_date']),
    targetPercent: toNum(r['target_percent']), goalAchievement: toNum(r['goal_achievement']),
    utilizationPercent: toNum(r['utilization_percent']), efficiencyPercent: toNum(r['efficiency_percent']),
    efficiencyLabel: r['efficiency_label'] ?? null, systemGrade: toNum(r['system_grade']),
    managerAvgRating: toNum(r['manager_avg_rating']), finalRating: toNum(r['final_rating']),
    managerRatings: r['manager_ratings'] ?? null, feedback: r['feedback'] ?? null, status: r['status'] ?? null,
    submittedAt: toNum(r['submitted_at']), createdAt: iso(r['created_at']), updatedAt: iso(r['updated_at']),
  };
}

async function departmentNames(userIds: number[]) {
  const map = new Map<number, string>();
  if (!userIds.length) return map;
  const [rows] = await pool.query<Row[]>(
    `SELECT du.UserID, d.DepartmentName FROM DepartmentUser du JOIN Department d ON d.DepartmentID = du.DepartmentID
     WHERE du.UserID IN (?) ORDER BY d.DepartmentID`, [userIds]);
  for (const r of rows) if (!map.has(r['UserID'])) map.set(r['UserID'], r['DepartmentName']);
  return map;
}

const QUARTERLY_SELECT = `SELECT qr.*, u.UserName, u.UserEmail FROM quarterlyreview qr JOIN Users u ON u.UserID = qr.emp_id`;

export async function listQuarterly(empId?: number, quarter?: string, year?: string) {
  const [rows] = await pool.query<Row[]>(
    `${QUARTERLY_SELECT} ${empId ? 'WHERE qr.emp_id = ?' : ''} ORDER BY qr.created_at DESC`, empId ? [empId] : []);
  let list = rows;
  if (quarter && quarter.toUpperCase() !== 'ALL') list = list.filter((r) => String(r['quarter']).toUpperCase() === quarter.toUpperCase());
  if (year && year.toUpperCase() !== 'ALL') list = list.filter((r) => String(r['quarter_year']) === year);
  const dept = await departmentNames([...new Set(list.map((r) => r['emp_id'] as number))]);
  return list.map((r) => quarterlyDto(r, dept));
}

const quarterlyValues = (b: QuarterlyBody) => [
  b.quarter, b.quarterYear, b.quarterStartDate, b.quarterEndDate, b.targetPercent ?? null, b.goalAchievement ?? null,
  b.utilizationPercent ?? null, b.efficiencyPercent ?? null, b.efficiencyLabel ?? null, b.systemGrade ?? null,
  b.managerAvgRating ?? null, b.finalRating ?? null, b.status ?? null, jsonText(b.feedback), jsonText(b.grade),
  jsonText(b.managerRatings), b.submittedAt ?? null,
];
const QUARTERLY_COLS = `quarter = ?, quarter_year = ?, quarter_start_date = ?, quarter_end_date = ?, target_percent = ?, goal_achievement = ?,
  utilization_percent = ?, efficiency_percent = ?, efficiency_label = ?, system_grade = ?, manager_avg_rating = ?, final_rating = ?,
  status = ?, feedback = ?, grade = ?, manager_ratings = ?, submitted_at = ?`;

export async function createQuarterly(b: QuarterlyBody) {
  const [[emp]] = await pool.execute<Row[]>('SELECT UserID FROM Users WHERE UserID = ?', [b.empId ?? 0]);
  if (!emp) throw AppError.notFound('Employee not found');
  const [res] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO quarterlyreview SET emp_id = ?, ${QUARTERLY_COLS}, created_at = NOW(), updated_at = NOW()`,
    [b.empId, ...quarterlyValues(b)] as never[]);
  return res.insertId;
}

export async function updateQuarterly(id: number, b: QuarterlyBody) {
  const [res] = await pool.execute<mysql.ResultSetHeader>(
    `UPDATE quarterlyreview SET ${QUARTERLY_COLS}, updated_at = NOW() WHERE id = ?`, [...quarterlyValues(b), id] as never[]);
  if (!res.affectedRows) throw AppError.notFound('Quarterly review not found');
  return id;
}

export async function deleteQuarterly(id: number) {
  await pool.execute('DELETE FROM quarterlyreview WHERE id = ?', [id]);
}

// ── Monthly ──────────────────────────────────────────────────────────────────

export interface MonthlyBody {
  empId?: number; month?: string; year?: number; target?: number; goal?: number; utilization?: number; efficiency?: number;
  startDate?: string; endDate?: string; efficiencyLabel?: string; status?: string; feedback?: unknown; accessor?: unknown; timestamp?: number;
}

function monthlyDto(r: Row) {
  return {
    id: r['id'], empId: r['emp_id'], month: r['month'], year: r['year'], target: toNum(r['target']), goal: toNum(r['goal']),
    utilization: toNum(r['utilization']), efficiency: toNum(r['efficiency']), efficiencyLabel: r['efficiency_label'] ?? null,
    status: r['status'] ?? null, startDate: day(r['start_date']), endDate: day(r['end_date']),
    feedback: parseJson(r['feedback'], null), accessor: parseJson(r['accessor'], null), timestamp: toNum(r['timestamp']),
    createdAt: iso(r['created_at']), updatedAt: iso(r['updated_at']),
  };
}

export async function listMonthly(empId: number, year: string) {
  const [rows] = await pool.execute<Row[]>('SELECT * FROM monthlyreview WHERE emp_id = ? ORDER BY id DESC', [empId]);
  const list = year.toUpperCase() === 'ALL' ? rows : rows.filter((r) => String(r['year']) === year);
  return list.map(monthlyDto);
}

export async function createMonthly(b: MonthlyBody) {
  const [dupes] = await pool.execute<Row[]>(
    'SELECT id FROM monthlyreview WHERE emp_id = ? AND month = ? AND year = ? AND start_date <=> ? AND end_date <=> ?',
    [b.empId ?? 0, b.month ?? '', b.year ?? 0, b.startDate ?? null, b.endDate ?? null]);
  if (dupes.length) throw AppError.badRequest('Monthly review already exists for this date range');
  const [res] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO monthlyreview (emp_id, month, year, target, goal, utilization, efficiency, efficiency_label, status, start_date, end_date, feedback, accessor, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.empId, b.month, b.year, b.target ?? null, b.goal ?? null, b.utilization ?? null, b.efficiency ?? null, b.efficiencyLabel ?? null,
      b.status ?? null, b.startDate ?? null, b.endDate ?? null, jsonText(b.feedback), jsonText(b.accessor), b.timestamp ?? null] as never[]);
  const [[row]] = await pool.execute<Row[]>('SELECT * FROM monthlyreview WHERE id = ?', [res.insertId]);
  return monthlyDto(row!);
}

export async function deleteMonthly(id: number) {
  const [res] = await pool.execute<mysql.ResultSetHeader>('DELETE FROM monthlyreview WHERE id = ?', [id]);
  if (!res.affectedRows) throw AppError.notFound('Monthly review not found');
}

// ── Review status (Reports → User Review Status) ─────────────────────────────

const quarterOf = (month: number) => `Q${Math.floor((month - 1) / 3) + 1}`;

export async function reviewStatusSummary(f: { departmentID?: number; filterType?: string; quarter?: string; month?: number; year?: string }) {
  const type = String(f.filterType ?? '').toLowerCase();
  let quarters: string[]; let periodLabel: string;
  // No year (or ALL) means every year
  const allYears = !f.year || String(f.year).toUpperCase() === 'ALL';
  const year = allYears ? null : Number(f.year);
  if (type === 'month' || type === 'monthly') {
    const month = Number(f.month ?? 1);
    quarters = [quarterOf(month)];
    periodLabel = `${allYears ? 'all' : f.year}-${String(month).padStart(2, '0')}`;
  } else if (type === 'quarter' || type === 'quarterly') {
    const q = String(f.quarter ?? 'all');
    quarters = q.toLowerCase() === 'all' ? ['Q1', 'Q2', 'Q3', 'Q4'] : [q.toUpperCase()];
    periodLabel = `${q} ${allYears ? 'all years' : f.year}`;
  } else {
    throw AppError.badRequest(`Invalid filterType: ${f.filterType}`);
  }

  const dept = f.departmentID ?? null;
  const [rows] = await pool.query<Row[]>(
    `SELECT qr.emp_id AS userID, u.UserName AS userName, u.UserEmail AS userEmail, COUNT(*) AS entryCount,
            MAX(qr.system_grade) AS systemGrade, MAX(qr.manager_avg_rating) AS managerAvgRating, MAX(qr.final_rating) AS finalRating,
            MAX(qr.manager_ratings) AS managerRatings, MAX(qr.target_percent) AS targetPercent, MAX(qr.goal_achievement) AS goalAchievement,
            MAX(u.EmployeeID) AS empId, MAX(rm.UserName) AS reportingManagerName, MAX(el.UserName) AS elName,
            (SELECT MAX(d.DepartmentName) FROM DepartmentUser du2 JOIN Department d ON d.DepartmentID = du2.DepartmentID WHERE du2.UserID = u.UserID) AS department
     FROM quarterlyreview qr
     JOIN Users u ON u.UserID = qr.emp_id
     LEFT JOIN Users rm ON rm.UserID = u.ReportingManagerID
     LEFT JOIN Users el ON el.UserID = u.ELManagerID
     WHERE (? IS NULL OR qr.quarter_year = ?) AND qr.quarter IN (?)
       AND (? IS NULL OR EXISTS (SELECT 1 FROM DepartmentUser du WHERE du.UserID = u.UserID AND du.DepartmentID = ?))
     GROUP BY qr.emp_id, u.UserName, u.UserEmail
     ORDER BY u.UserName`,
    [year, year, quarters, dept, dept]);

  // Assessor names come from the ids saved inside managerRatings
  const ids = new Set<number>();
  for (const r of rows) {
    const ratings = parseJson(r['managerRatings'], {}) as Record<string, any>;
    for (const dim of Object.values(ratings ?? {})) {
      for (const k of ['assessor1Id', 'assessor2Id']) { const n = Number(dim?.[k]); if (n) ids.add(n); }
    }
  }
  const names = new Map<number, string>();
  if (ids.size) {
    const [u] = await pool.query<Row[]>('SELECT UserID, UserName FROM Users WHERE UserID IN (?)', [[...ids]]);
    for (const x of u) names.set(x['UserID'], x['UserName']);
  }
  const reviewedUsers = rows.map((r) => {
    const ratings = parseJson(r['managerRatings'], {}) as Record<string, any>;
    let a1: string | null = null; let a2: string | null = null;
    for (const dim of Object.values(ratings ?? {})) {
      if (!a1 && dim?.assessor1Id) a1 = names.get(Number(dim.assessor1Id)) ?? null;
      if (!a2 && dim?.assessor2Id) a2 = names.get(Number(dim.assessor2Id)) ?? null;
    }
    return {
      userID: r['userID'], userName: r['userName'], userEmail: r['userEmail'], entryCount: toNum(r['entryCount']),
      systemGrade: toNum(r['systemGrade']), managerAvgRating: toNum(r['managerAvgRating']), finalRating: toNum(r['finalRating']),
      managerRatings: r['managerRatings'] ?? null, targetPercent: toNum(r['targetPercent']), goalAchievement: toNum(r['goalAchievement']),
      empId: r['empId'] ?? null, department: r['department'] ?? null, accessor1: a1, accessor2: a2,
      elName: r['elName'] ?? null, reportingManagerName: r['reportingManagerName'] ?? null,
    };
  });

  const reviewedIds = new Set(reviewedUsers.map((u) => u.userID as number));
  const [all] = await pool.query<Row[]>(
    dept
      ? `SELECT u.UserID, u.UserName, u.UserEmail FROM Users u JOIN DepartmentUser du ON du.UserID = u.UserID
         WHERE du.DepartmentID = ? AND u.UserStatus = 1 AND u.IsUserArchived = 0`
      : 'SELECT UserID, UserName, UserEmail FROM Users WHERE UserStatus = 1 AND IsUserArchived = 0',
    dept ? [dept] : []);
  const nonReviewedUsers = all.filter((u) => !reviewedIds.has(u['UserID'])).map((u) => ({
    userID: u['UserID'], userName: u['UserName'], userEmail: u['UserEmail'], entryCount: 0,
  }));

  return {
    departmentID: dept, filterType: f.filterType, periodLabel, totalUsers: reviewedUsers.length + nonReviewedUsers.length,
    reviewedCount: reviewedUsers.length, nonReviewedCount: nonReviewedUsers.length, reviewedUsers, nonReviewedUsers,
  };
}
