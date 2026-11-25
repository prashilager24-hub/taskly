/**
 * People Hub → PMS → Target & Goals (and the PMS Dashboard): the Performance Report figures for whoever the viewer may
 * see, plus adding entries and the managers' yearly PMS weight shift (Model X, modules/pms/pmsScore.ts).
 *
 *  - Employee: only their own data. Adds their own target entries (saved like Daily Activity → UserWorkData).
 *  - EL / FL / manager: themselves and their team by the Hierarchy (access/hierarchy.ts hierarchyTeamOf). May move up to
 *    5% of weight between Goal and Target for a teammate for a year, with a justification.
 *  - Goal entries are added by Admins only (role 1 / Super Admin), for anyone.
 *  - Admin / Super Admin (role 1): everyone.
 * Goal entries go to UserGoalData, as Daily Activity saves them. Shifts are kept in PmsWeightage (migration 026).
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { logger } from '../../config/logger';
import { calculateAndSaveDailyEfficiency } from '../../jobs/efficiencyCalculation';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { AppError } from '../../utils/AppError';
import { sendSuccess } from '../../utils/response';
import { hierarchyTeamOf } from '../access/hierarchy';
import { can } from '../access/access.service';
import { requireModule } from '../../middlewares/permission';
import { bulkCreateUserWorkData, bulkUpsertUserGoalData } from '../form/form.service';
import { performanceReport, performanceReportOptions } from './performanceReport.service';

type DbRow = mysql.RowDataPacket;
const router = Router();
router.use(authenticate);

// Access Management: PMS → Target & Goals (hub_taskly_goals) and Dashboard → PMS Dashboard (hub_dashboard_pms)
const GOALS = 'hub_taskly_goals', DASH = 'hub_dashboard_pms';
const eitherPage = (req: Request, _res: Response, next: NextFunction) => {
  const userId = Number(req.user?.sub);
  Promise.all([can(userId, GOALS), can(userId, DASH)])
    .then(([a, b]) => (a || b ? next() : next(AppError.forbidden('You do not have access to Target & Goals or the PMS Dashboard'))))
    .catch(next);
};


type Kind = 'admin' | 'lead' | 'employee';
interface Viewer { id: number; role: number; kind: Kind; team: 'all' | Set<number> }
async function viewerOf(req: { user?: { sub?: string | number; role?: number } }): Promise<Viewer> {
  const id = Number(req.user?.sub), role = Number(req.user?.role);
  // the team comes from the Hierarchy (Access Management → Hierarchy): the people this person assesses, and below them
  const team = await hierarchyTeamOf(id, role);
  return { id, role, team, kind: team === 'all' ? 'admin' : team.size ? 'lead' : 'employee' };
}
/** null = everyone; otherwise the viewer and their team */
const scopeFor = (v: Viewer): Set<number> | null => (v.team === 'all' ? null : new Set([v.id, ...v.team]));
/** May set this person's weight shift: Admin anyone, a leader their team (never themselves) */
const manages = (v: Viewer, userId: number) => v.team === 'all' || v.team.has(userId);

/** The managers' weight shifts for a year: userId → shift (−0.05 … +0.05), why, who and when */
async function shiftsFor(userIds: number[], year: number) {
  if (!userIds.length) return {};
  const [rows] = await pool.query<DbRow[]>(
    `SELECT w.UserID, w.GoalShift, w.Justification, w.SetAt, u.UserName FROM PmsWeightage w LEFT JOIN Users u ON u.UserID = w.SetBy
     WHERE w.PeriodYear = ? AND w.UserID IN (?)`, [year, userIds]);
  return Object.fromEntries(rows.map((r) => [Number(r['UserID']), { shift: Number(r['GoalShift']), justification: String(r['Justification']), setBy: r['UserName'] ?? null, setAt: r['SetAt'] }]));
}

/** Rebuild the day rows so a new target entry shows in the figures now, not at the 6 AM run (skipped if one is running) */
function refreshDayRows() {
  calculateAndSaveDailyEfficiency().catch((err) => logger.error({ err }, 'Efficiency recalculation after a Target & Goals entry failed'));
}

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-01-31');

// ── who is looking, and the filter lists ──
router.get('/context', eitherPage, async (req, res, next) => {
  try {
    const from = String(req.query['from'] ?? ''), to = String(req.query['to'] ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw AppError.badRequest('from and to must be dates like 2026-01-31');
    const v = await viewerOf(req);
    const options = await performanceReportOptions(from, to, scopeFor(v));
    sendSuccess(res, { viewer: { id: v.id, kind: v.kind }, options });
  } catch (e) { next(e); }
});

// ── the figures (Performance Overview's, plus the Model X PMS score) + the managers' weight shifts for the year ──
const ReportSchema = z.object({
  from: ymd, to: ymd,
  departmentId: z.coerce.number().int().nullish(),
  subDepartmentId: z.coerce.number().int().positive().nullish(),
  userId: z.coerce.number().int().positive().nullish(),
  grain: z.enum(['day', 'month', 'quarter', 'year']),
  excludeZero: z.boolean().default(false),
  quarters: z.array(z.coerce.number().int().min(1).max(4)).nullish(),
}).refine((f) => f.from <= f.to, { message: 'The start date must be on or before the end date', path: ['to'] });

router.post('/report', eitherPage, validate(ReportSchema), async (req, res, next) => {
  try {
    const v = await viewerOf(req);
    const scope = scopeFor(v);
    // an employee always sees only themselves
    const body = v.kind === 'employee' ? { ...req.body, userId: v.id, departmentId: null, subDepartmentId: null } : req.body;
    if (scope && body.userId && !scope.has(body.userId)) throw AppError.forbidden('You can see only your own and your team’s performance');
    const report = await performanceReport(body, scope);
    const ids = [...new Set([...report.people.map((p) => p.userId), ...(body.userId ? [body.userId] : [])])];
    const shifts = await shiftsFor(ids, report.pms.shiftYear);
    const editable = ids.filter((id) => manages(v, id));
    sendSuccess(res, { ...report, shifts, editable });
  } catch (e) { next(e); }
});

// ── a manager moves up to 5% of weight between Goal and Target for one person for a year (0 removes it) ──
const ShiftSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  shift: z.coerce.number().min(-0.05).max(0.05),
  justification: z.string().trim().max(500).nullish(),
});
router.put('/shift/:userId', requireModule(DASH), validate(ShiftSchema), async (req, res, next) => {
  try {
    const v = await viewerOf(req);
    const userId = Number(req.params['userId']);
    if (!Number.isInteger(userId) || userId <= 0) throw AppError.badRequest('Pick a person');
    if (!manages(v, userId) || userId === v.id && v.kind !== 'admin') throw AppError.forbidden('Only an Admin or this person’s leader can change their weighting');
    const shift = Math.round(Number(req.body.shift) * 1000) / 1000;
    if (shift === 0) {
      await pool.query('DELETE FROM PmsWeightage WHERE UserID = ? AND PeriodYear = ?', [userId, req.body.year]);
    } else {
      if (!req.body.justification) throw AppError.badRequest('Give a justification: HR sees it');
      await pool.query(
        `INSERT INTO PmsWeightage (UserID, PeriodYear, GoalShift, Justification, SetBy) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE GoalShift = VALUES(GoalShift), Justification = VALUES(Justification), SetBy = VALUES(SetBy)`,
        [userId, req.body.year, shift, req.body.justification, v.id]);
    }
    sendSuccess(res, { userId, year: req.body.year, shift });
  } catch (e) { next(e); }
});

// ── lists for the Add forms: the viewer's own targets; for leaders, their team and those people's goals ──
router.get('/add-options', requireModule(GOALS), async (req, res, next) => {
  try {
    const v = await viewerOf(req);
    const [targets] = await pool.query<DbRow[]>(
      `SELECT t.TargetID, t.TargetName, t.Unit, t.Frequency, t.DepartmentID, d.DepartmentName
       FROM DepartmentTarget t JOIN DepartmentUser du ON du.DepartmentID = t.DepartmentID AND du.UserID = ?
       JOIN Department d ON d.DepartmentID = t.DepartmentID
       WHERE t.IsActive = 1 AND d.IsDepartmentArchived = 0 ORDER BY d.DepartmentName, t.TargetName`, [v.id]);
    let people: { id: number; name: string; subDepartmentIds: number[] }[] = [];
    let goals: DbRow[] = [];
    if (v.kind === 'admin') {
      const [rows] = await pool.query<DbRow[]>(
        `SELECT u.UserID, u.UserName, du.DepartmentID FROM Users u JOIN DepartmentUser du ON du.UserID = u.UserID
         JOIN Department d ON d.DepartmentID = du.DepartmentID
         WHERE u.IsUserArchived = 0 AND d.IsDepartmentArchived = 0 ORDER BY u.UserName`);
      const map = new Map<number, { id: number; name: string; subDepartmentIds: number[] }>();
      for (const r of rows) {
        const id = Number(r['UserID']);
        if (!manages(v, id)) continue;
        const p = map.get(id) ?? { id, name: String(r['UserName']), subDepartmentIds: [] };
        p.subDepartmentIds.push(Number(r['DepartmentID'])); map.set(id, p);
      }
      people = [...map.values()];
      const subs = [...new Set(people.flatMap((p) => p.subDepartmentIds))];
      if (subs.length) {
        [goals] = await pool.query<DbRow[]>(
          `SELECT g.GoalID, g.GoalName, g.Unit, g.Frequency, g.DepartmentID, d.DepartmentName
           FROM DepartmentGoal g JOIN Department d ON d.DepartmentID = g.DepartmentID
           WHERE g.IsActive = 1 AND g.DepartmentID IN (?) ORDER BY g.GoalName`, [subs]);
      }
    }
    const item = (idKey: string, nameKey: string) => (r: DbRow) => ({
      id: Number(r[idKey]), name: String(r[nameKey]), unit: r['Unit'] == null || r['Unit'] === '' ? null : Number(r['Unit']),
      frequency: r['Frequency'] ?? null, subDepartmentId: Number(r['DepartmentID']), subDepartment: String(r['DepartmentName']),
    });
    sendSuccess(res, { canAddGoal: v.kind === 'admin', targets: targets.map(item('TargetID', 'TargetName')), people, goals: goals.map(item('GoalID', 'GoalName')) });
  } catch (e) { next(e); }
});

const num = z.coerce.number().min(0).max(1e9);
// ── an employee adds their own target entry ──
router.post('/target', requireModule(GOALS, 'create'), validate(z.object({ targetId: z.coerce.number().int().positive(), workDate: ymd, expected: num, achieved: num, remarks: z.string().max(2000).nullish() })), async (req, res, next) => {
  try {
    const v = await viewerOf(req);
    const b = req.body as { targetId: number; workDate: string; expected: number; achieved: number; remarks?: string | null };
    const [rows] = await pool.query<DbRow[]>(
      `SELECT t.DepartmentID FROM DepartmentTarget t JOIN DepartmentUser du ON du.DepartmentID = t.DepartmentID AND du.UserID = ?
       WHERE t.TargetID = ? AND t.IsActive = 1 LIMIT 1`, [v.id, b.targetId]);
    if (!rows.length) throw AppError.badRequest('This target is not one of your sub department’s active targets');
    if (b.workDate > new Date().toISOString().slice(0, 10)) throw AppError.badRequest('The date cannot be in the future');
    const [saved] = await bulkCreateUserWorkData([{
      taskID: 0, targetID: b.targetId, userID: v.id, workDate: b.workDate, departmentID: Number(rows[0]!['DepartmentID']),
      units: b.expected, achivedUnits: b.achieved, isForTarget: true, remarks: b.remarks?.trim() || null,
      totalTimePerSetup: 0, timeTakenToWork: 0,
    }]);
    refreshDayRows();
    sendSuccess(res, saved ?? null, 201);
  } catch (e) { next(e); }
});

// ── an Admin adds a goal entry for anyone (goals are added by Admins only) ──
router.post('/goal', requireModule(GOALS), validate(z.object({ userId: z.coerce.number().int().positive(), goalId: z.coerce.number().int().positive(), workDate: ymd, expected: num, achieved: num, comment: z.string().max(2000).nullish() })), async (req, res, next) => {
  try {
    const v = await viewerOf(req);
    const b = req.body as { userId: number; goalId: number; workDate: string; expected: number; achieved: number; comment?: string | null };
    if (v.kind !== 'admin') throw AppError.forbidden('Only an Admin can add goals');
    const [rows] = await pool.query<DbRow[]>(
      `SELECT g.DepartmentID FROM DepartmentGoal g JOIN DepartmentUser du ON du.DepartmentID = g.DepartmentID AND du.UserID = ?
       WHERE g.GoalID = ? AND g.IsActive = 1 LIMIT 1`, [b.userId, b.goalId]);
    if (!rows.length) throw AppError.badRequest('This goal is not an active goal of this person’s sub department');
    const dept = Number(rows[0]!['DepartmentID']);
    if (dept === 18) throw AppError.badRequest('Goals of this sub department are logged elsewhere and cannot be added here');
    await bulkUpsertUserGoalData([{ userID: b.userId, goalID: b.goalId, departmentID: dept, workDate: b.workDate, fixedGoal: b.expected, achievedGoal: b.achieved, comment: b.comment?.trim() || null }]);
    sendSuccess(res, { saved: true }, 201);
  } catch (e) { next(e); }
});

export default router;
