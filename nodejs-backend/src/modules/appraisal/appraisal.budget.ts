/**
 * Hike budget, per year and department.
 *   Finance gives an EL a budget for the department.
 *   The EL splits it between the Functional Leaders / Managers.
 *   A FL proposes hikes for their team inside their share. An Associate never sees any budget.
 * Amounts are annual rupees. "Used" is what the cycles already commit: the approved hike once it is on offer or accepted,
 * otherwise the FL's proposed hike while the cycle is being reviewed. A postponed hike is not counted.
 */
import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { AppError } from '../../utils/AppError';
import { isFinance } from './appraisal.service';

type Row = mysql.RowDataPacket;

export interface FlLine { userId: number; name: string; allocation: number; used: number; remaining: number; associates: number }
export interface DeptBudget {
  departmentId: number; name: string; el: { userId: number; name: string } | null;
  budget: number | null; comment: string; allocated: number; used: number; fls: FlLine[];
}
export type BudgetRole = 'FINANCE' | 'EL' | 'FL' | 'NONE';
/** What an FL is shown: only their own share, never the department budget or the other FLs */
export interface MyShare { departmentId: number; name: string; allocation: number; used: number; remaining: number; associates: number }

const n = (v: unknown) => Number(v ?? 0);
const FL_ROLES = '4, 7, 23';

async function usedByFl(year: number) {
  const [rows] = await pool.execute<Row[]>(
    `SELECT du.DepartmentID AS dept, c.Assessor1UserID AS fl, COUNT(DISTINCT c.CycleID) AS cnt,
            SUM(CASE WHEN ap.AnnualAmount IS NOT NULL AND c.Status IN ('OFFERED', 'ACCEPTED') THEN ap.AnnualAmount
                     WHEN c.Status IN ('ASSESSOR_OPEN', 'FINANCE_REVIEW') THEN COALESCE(pr.AnnualAmount, 0) ELSE 0 END) AS used
       FROM AppraisalCycle c
       JOIN DepartmentUser du ON du.UserID = c.UserID
       LEFT JOIN AppraisalHike ap ON ap.CycleID = c.CycleID AND ap.Kind = 'APPROVED' AND ap.ByRole = 'FINANCE'
       LEFT JOIN AppraisalHike pr ON pr.CycleID = c.CycleID AND pr.Kind = 'MINIMAL' AND pr.ByRole = 'A1'
      WHERE c.CycleYear = ? AND c.EmployeeLevel <> 'HEAD_EL' AND c.Assessor1UserID IS NOT NULL GROUP BY du.DepartmentID, c.Assessor1UserID`, [year]);
  return new Map(rows.map((r) => [`${r['dept']}:${r['fl']}`, { used: n(r['used']), associates: n(r['cnt']) }]));
}

/** Everyone who can be given a share of a department's budget: its FL, the managers its people report to, and the EL when people report to them directly */
async function candidates(departmentId: number): Promise<Map<number, string>> {
  const [rows] = await pool.execute<Row[]>(
    `SELECT u.UserID, u.UserName FROM Users u WHERE u.IsUserArchived = 0 AND u.UserStatus = 1 AND (
        u.UserID IN (SELECT FunctionalLeaderID FROM Department WHERE DepartmentID = ?)
        OR (u.RoleID IN (${FL_ROLES}) AND u.UserID IN (SELECT m.ReportingManagerID FROM Users m JOIN DepartmentUser du ON du.UserID = m.UserID WHERE du.DepartmentID = ? AND m.ReportingManagerID IS NOT NULL))
        OR u.UserID IN (SELECT DISTINCT c.Assessor1UserID FROM AppraisalCycle c JOIN DepartmentUser du ON du.UserID = c.UserID WHERE du.DepartmentID = ? AND c.Assessor1UserID IS NOT NULL)
        OR u.UserID IN (SELECT FlUserID FROM AppraisalBudgetAlloc WHERE DepartmentID = ?)
     ) ORDER BY u.UserName`, [departmentId, departmentId, departmentId, departmentId]);
  return new Map(rows.map((r) => [r['UserID'] as number, r['UserName'] as string]));
}

async function build(year: number, where: string, params: number[]): Promise<DeptBudget[]> {
  const [depts] = await pool.execute<Row[]>(
    `SELECT d.DepartmentID, d.DepartmentName, d.ExecutiveLeaderID, e.UserName AS ElName FROM Department d LEFT JOIN Users e ON e.UserID = d.ExecutiveLeaderID
      WHERE d.IsDepartmentArchived = 0 AND d.DepartmentStatus = 1 AND d.ExecutiveLeaderID IS NOT NULL ${where} ORDER BY d.DepartmentName`, params);
  const [budgets] = await pool.execute<Row[]>('SELECT DepartmentID, Amount, Comment FROM AppraisalBudget WHERE BudgetYear = ?', [year]);
  const [allocs] = await pool.execute<Row[]>('SELECT DepartmentID, FlUserID, Amount FROM AppraisalBudgetAlloc WHERE BudgetYear = ?', [year]);
  const used = await usedByFl(year);

  const out: DeptBudget[] = [];
  for (const d of depts) {
    const id = d['DepartmentID'] as number;
    const b = budgets.find((x) => x['DepartmentID'] === id);
    const people = await candidates(id);
    const fls: FlLine[] = [...people].map(([userId, name]) => {
      const allocation = n(allocs.find((a) => a['DepartmentID'] === id && a['FlUserID'] === userId)?.['Amount']);
      const u = used.get(`${id}:${userId}`);
      return { userId, name, allocation, used: u?.used ?? 0, remaining: allocation - (u?.used ?? 0), associates: u?.associates ?? 0 };
    });
    out.push({
      departmentId: id, name: d['DepartmentName'], el: d['ExecutiveLeaderID'] ? { userId: d['ExecutiveLeaderID'], name: d['ElName'] ?? '' } : null,
      budget: b ? n(b['Amount']) : null, comment: (b?.['Comment'] as string) ?? '',
      allocated: fls.reduce((t, f) => t + f.allocation, 0), used: fls.reduce((t, f) => t + f.used, 0), fls,
    });
  }
  return out;
}

export async function overview(userId: number, appRole: number, year: number) {
  if (isFinance(appRole)) return { year, role: 'FINANCE' as BudgetRole, departments: await build(year, '', []) };

  const led = await build(year, 'AND d.ExecutiveLeaderID = ?', [userId]);
  if (led.length) return { year, role: 'EL' as BudgetRole, departments: led };

  // a FL sees only their own share
  const [mine] = await pool.execute<Row[]>('SELECT DISTINCT DepartmentID FROM AppraisalBudgetAlloc WHERE FlUserID = ? AND BudgetYear = ?', [userId, year]);
  if (!mine.length) return { year, role: 'NONE' as BudgetRole, shares: [] as MyShare[] };
  const all = await build(year, `AND d.DepartmentID IN (${mine.map(() => '?').join(',')})`, mine.map((m) => m['DepartmentID'] as number));
  const shares: MyShare[] = all.flatMap((d) => d.fls.filter((f) => f.userId === userId).map((f) => ({ departmentId: d.departmentId, name: d.name, allocation: f.allocation, used: f.used, remaining: f.remaining, associates: f.associates })));
  return { year, role: 'FL' as BudgetRole, shares };
}

export async function setDepartmentBudget(actor: number, appRole: number, input: { year: number; departmentId: number; amount: number; comment?: string }) {
  if (!isFinance(appRole)) throw AppError.forbidden('Only Finance sets a department budget');
  const [d] = await pool.execute<Row[]>('SELECT ExecutiveLeaderID FROM Department WHERE DepartmentID = ? AND IsDepartmentArchived = 0', [input.departmentId]);
  if (!d[0]) throw AppError.notFound('Department not found');
  if (!d[0]['ExecutiveLeaderID']) throw AppError.badRequest('This department has no Executive Leader to give a budget to');
  const [a] = await pool.execute<Row[]>('SELECT COALESCE(SUM(Amount), 0) AS total FROM AppraisalBudgetAlloc WHERE BudgetYear = ? AND DepartmentID = ?', [input.year, input.departmentId]);
  if (input.amount < n(a[0]?.['total'])) throw AppError.conflict(`The EL has already given out ${n(a[0]?.['total'])} of this budget. Set it at least that high.`);
  await pool.execute(
    `INSERT INTO AppraisalBudget (BudgetYear, DepartmentID, Amount, Comment, SetBy) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE Amount = VALUES(Amount), Comment = VALUES(Comment), SetBy = VALUES(SetBy)`, [input.year, input.departmentId, input.amount, input.comment ?? null, actor]);
}

export async function setAllocation(actor: number, appRole: number, input: { year: number; departmentId: number; flUserId: number; amount: number }) {
  const [d] = await pool.execute<Row[]>('SELECT ExecutiveLeaderID FROM Department WHERE DepartmentID = ? AND IsDepartmentArchived = 0', [input.departmentId]);
  if (!d[0]) throw AppError.notFound('Department not found');
  if (appRole !== 1 && d[0]['ExecutiveLeaderID'] !== actor) throw AppError.forbidden('Only the Executive Leader of this department gives out its budget');
  const [b] = await pool.execute<Row[]>('SELECT Amount FROM AppraisalBudget WHERE BudgetYear = ? AND DepartmentID = ?', [input.year, input.departmentId]);
  if (!b[0]) throw AppError.conflict('Finance has not given this department a budget yet');
  const people = await candidates(input.departmentId);
  if (!people.has(input.flUserId)) throw AppError.badRequest('That person does not lead a team in this department');
  const [o] = await pool.execute<Row[]>('SELECT COALESCE(SUM(Amount), 0) AS total FROM AppraisalBudgetAlloc WHERE BudgetYear = ? AND DepartmentID = ? AND FlUserID <> ?', [input.year, input.departmentId, input.flUserId]);
  const total = n(o[0]?.['total']) + input.amount;
  if (total > n(b[0]['Amount'])) throw AppError.conflict(`That would give out ${total} of a ${n(b[0]['Amount'])} budget`);
  await pool.execute(
    `INSERT INTO AppraisalBudgetAlloc (BudgetYear, DepartmentID, FlUserID, Amount, SetBy) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE Amount = VALUES(Amount), SetBy = VALUES(SetBy)`, [input.year, input.departmentId, input.flUserId, input.amount, actor]);
}
