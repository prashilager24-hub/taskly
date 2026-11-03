import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { AppError } from '../../utils/AppError';

// Each employee writes their own biggest achievement and biggest failure for a quarter.
// The manager's PMS Quarterly Review needs both before it can be submitted (see requireReflection),
// and Appraisal shows them in its quarter grid.

type Row = mysql.RowDataPacket;
type Db = Pick<mysql.Pool, 'execute'>;

export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
export const MAX_LENGTH = 1000;

const isQuarter = (q: unknown): q is (typeof QUARTERS)[number] => QUARTERS.includes(q as (typeof QUARTERS)[number]);

/** First day of a calendar quarter, as YYYY-MM-DD */
const quarterStart = (quarter: string, year: number) => `${year}-${String((QUARTERS.indexOf(quarter as (typeof QUARTERS)[number]) * 3) + 1).padStart(2, '0')}-01`;

const dto = (r: Row) => ({
  id: r['ReflectionID'], userId: r['UserID'], quarter: r['Quarter'], year: Number(r['QuarterYear']),
  biggestAchievement: r['BiggestAchievement'] as string, biggestFailure: r['BiggestFailure'] as string,
  updatedAt: r['UpdatedAt'] instanceof Date ? r['UpdatedAt'].toISOString() : String(r['UpdatedAt']),
});

/** A person's notes for one year, plus whether each quarter has started and whether its PMS review is already in (locked) */
export async function listMine(userId: number, year: number) {
  const [rows] = await pool.execute<Row[]>('SELECT * FROM QuarterReflection WHERE UserID = ? AND QuarterYear = ?', [userId, year]);
  const [reviews] = await pool.execute<Row[]>('SELECT quarter FROM quarterlyreview WHERE emp_id = ? AND quarter_year = ?', [userId, year]);
  const reviewed = new Set(reviews.map((r) => String(r['quarter'])));
  const today = new Date().toISOString().slice(0, 10);
  return {
    year,
    quarters: QUARTERS.map((quarter) => {
      const saved = rows.find((r) => r['Quarter'] === quarter);
      return { quarter, started: quarterStart(quarter, year) <= today, locked: reviewed.has(quarter) && !!saved, reflection: saved ? dto(saved) : null };
    }),
  };
}

const clean = (v: unknown, label: string) => {
  const text = typeof v === 'string' ? v.trim() : '';
  if (!text) throw AppError.badRequest(`${label} is required`);
  if (text.length > MAX_LENGTH) throw AppError.badRequest(`${label} can be at most ${MAX_LENGTH} characters`);
  return text;
};

/** Only the signed-in person can write their own notes; once the manager's review for the quarter is in they are locked */
export async function saveMine(userId: number, b: { quarter?: unknown; year?: unknown; biggestAchievement?: unknown; biggestFailure?: unknown }) {
  if (!isQuarter(b.quarter)) throw AppError.badRequest('Quarter must be Q1, Q2, Q3 or Q4');
  const year = Number(b.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw AppError.badRequest('Year is not valid');
  const achievement = clean(b.biggestAchievement, 'Biggest achievement');
  const failure = clean(b.biggestFailure, 'Biggest failure');

  if (quarterStart(b.quarter, year) > new Date().toISOString().slice(0, 10)) throw AppError.badRequest(`${b.quarter} ${year} has not started yet`);
  const [[review]] = await pool.execute<Row[]>('SELECT id FROM quarterlyreview WHERE emp_id = ? AND quarter = ? AND quarter_year = ? LIMIT 1', [userId, b.quarter, year]);
  const [[already]] = await pool.execute<Row[]>('SELECT 1 AS ok FROM QuarterReflection WHERE UserID = ? AND Quarter = ? AND QuarterYear = ? LIMIT 1', [userId, b.quarter, year]);
  if (review && already) throw AppError.badRequest(`Your ${b.quarter} ${year} review has already been submitted, so your notes are locked`);

  await pool.execute(
    `INSERT INTO QuarterReflection (UserID, Quarter, QuarterYear, BiggestAchievement, BiggestFailure) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE BiggestAchievement = VALUES(BiggestAchievement), BiggestFailure = VALUES(BiggestFailure)`,
    [userId, b.quarter, year, achievement, failure]);
  const [[row]] = await pool.execute<Row[]>('SELECT * FROM QuarterReflection WHERE UserID = ? AND Quarter = ? AND QuarterYear = ?', [userId, b.quarter, year]);
  return dto(row!);
}

/** What a reviewer sees for the person they are reviewing: the notes, or null while the person has not written them */
export async function getFor(empId: number, quarter: string, year: number) {
  const [[row]] = await pool.execute<Row[]>('SELECT * FROM QuarterReflection WHERE UserID = ? AND Quarter = ? AND QuarterYear = ?', [empId, quarter, year]);
  return row ? dto(row) : null;
}

/** Stops a quarterly review being submitted before the employee has written both notes */
export async function requireReflection(empId: number, quarter: string | undefined, year: number | undefined, db: Db = pool) {
  if (!quarter || !year) return;
  const [[row]] = await db.execute<Row[]>('SELECT 1 AS ok FROM QuarterReflection WHERE UserID = ? AND Quarter = ? AND QuarterYear = ? LIMIT 1', [empId, quarter, year]);
  if (row) return;
  const [[u]] = await db.execute<Row[]>('SELECT UserName FROM Users WHERE UserID = ?', [empId]);
  throw AppError.badRequest(`${(u?.['UserName'] as string) ?? 'The employee'} has not yet entered their biggest achievement and biggest failure for ${quarter} ${year}. The review can be submitted once they have.`);
}
