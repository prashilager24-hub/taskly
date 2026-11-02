/**
 * PMS dashboard overview (company analytics): who should be reviewed, who has been, for quarterly reviews
 * and for monthly manager feedback. The frontend groups it by quarter / month, year and EL team.
 *
 * "Should be reviewed" = every active, non-archived person except Admin (the CEO / CBO is not reviewed).
 */
import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';

type Row = mysql.RowDataPacket;

const toNum = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const parseJson = (v: unknown, fallback: unknown) => {
  if (typeof v !== 'string' || !v) return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
};

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** Monthly rows were saved as "April", "March 2026" or a year of 0: work out the real month and year */
function monthAndYear(label: unknown, year: unknown, start: unknown, created: unknown): { month: number | null; year: number | null } {
  const text = String(label ?? '').toLowerCase();
  const m = MONTHS.findIndex((name) => text.includes(name.slice(0, 3)));
  const inLabel = text.match(/\b(20\d\d)\b/)?.[1];
  const y = Number(year) > 0 ? Number(year) : inLabel ? Number(inLabel) : start ? new Date(String(start)).getUTCFullYear() : created ? new Date(created as Date).getUTCFullYear() : null;
  return { month: m >= 0 ? m + 1 : null, year: y };
}

export async function pmsOverview() {
  const [people] = await pool.query<Row[]>(
    `SELECT u.UserID, u.UserName, u.RoleID, u.ELManagerID, el.UserName AS elName,
            (SELECT d.DepartmentName FROM DepartmentUser du JOIN Department d ON d.DepartmentID = du.DepartmentID
              WHERE du.UserID = u.UserID ORDER BY d.DepartmentID LIMIT 1) AS department
     FROM Users u LEFT JOIN Users el ON el.UserID = u.ELManagerID
     WHERE u.UserStatus = 1 AND u.IsUserArchived = 0 AND u.RoleID <> 1
     ORDER BY u.UserName`);

  const [quarterly] = await pool.query<Row[]>(
    `SELECT id, emp_id, quarter, quarter_year, target_percent, goal_achievement, final_rating, system_grade, status FROM quarterlyreview`);

  const [monthly] = await pool.query<Row[]>(
    `SELECT id, emp_id, month, year, target, goal, utilization, efficiency, efficiency_label, status, start_date, created_at, feedback FROM monthlyreview`);

  return {
    people: people.map((p) => ({
      userID: p['UserID'], name: p['UserName'], department: p['department'] ?? '—', elId: p['ELManagerID'] ?? null, elName: p['elName'] ?? null,
    })),
    quarterly: quarterly.map((r) => ({
      id: r['id'], empId: r['emp_id'], quarter: r['quarter'], year: toNum(r['quarter_year']),
      target: toNum(r['target_percent']), goal: toNum(r['goal_achievement']), finalRating: toNum(r['final_rating']), systemGrade: toNum(r['system_grade']),
    })),
    monthly: monthly.map((r) => {
      const { month, year } = monthAndYear(r['month'], r['year'], r['start_date'], r['created_at']);
      const feedback = parseJson(r['feedback'], []);
      const categories = Array.isArray(feedback) ? [...new Set(feedback.map((f: { feedbackCat?: string }) => String(f?.feedbackCat ?? '').trim()).filter(Boolean))] : [];
      return {
        id: r['id'], empId: r['emp_id'], month, year, target: toNum(r['target']), goal: toNum(r['goal']), utilization: toNum(r['utilization']),
        efficiency: toNum(r['efficiency']), label: r['efficiency_label'] || null, categories,
      };
    }),
  };
}
