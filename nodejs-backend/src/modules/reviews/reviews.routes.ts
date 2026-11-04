/**
 * Reviews routes — ports of:
 *   MonthlyReviewController  → /t2.0/authentificationUtilization/monthly-reviews
 *   QuarterlyReviewController→ /t2.0/authentificationUtilization/quarterly-review
 *   GoalEfficiencyController → /t2.0/authentificationUtilization/goal-efficiency
 *
 * All three routers are exported; app.ts mounts each at its own sub-path.
 */
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { sendSuccess } from '../../utils/response';
import * as svc from './reviews.service';
import * as pms from './pmsReviews.service';
import * as reflection from './quarterReflection.service';
import { pmsOverview } from './pmsOverview.service';
import { requireModule } from '../../middlewares/permission';
import { assertCanRead, assertTeam, readablePeople } from '../access/team';
import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';

// who is asking; reviews are written for and read by the person's own team leaders (Admin / Super Admin: anyone)
const viewer = (req: { user?: { sub?: string | number; role?: number } }) => ({ id: Number(req.user?.sub), role: Number(req.user?.role) });
const ownerOf = async (table: 'monthlyreview' | 'quarterlyreview', id: number) =>
  Number((await pool.query<mysql.RowDataPacket[]>(`SELECT emp_id FROM ${table} WHERE id = ?`, [id]))[0][0]?.['emp_id'] ?? 0);

// ── Monthly Reviews (Java contract: camelCase DTOs, plain arrays) ────────────
const monthlyRouter = Router();
monthlyRouter.use(authenticate);

// POST  /monthly-reviews
monthlyRouter.post('/', requireModule('pms_feedback', 'create'), async (req, res, next) => {
  try {
    const v = viewer(req);
    await assertTeam(v.id, v.role, [Number(req.body?.empId)], 'You can give feedback only to people in your team');
    res.status(201).json(await pms.createMonthly(req.body));
  } catch (e) { next(e); }
});

// GET   /monthly-reviews/:empId/:year   (year may be ALL)
monthlyRouter.get('/:empId/:year', async (req, res, next) => {
  try {
    const v = viewer(req);
    await assertCanRead(v.id, v.role, Number(req.params['empId']));
    res.json(await pms.listMonthly(Number(req.params['empId']), String(req.params['year'])));
  } catch (e) { next(e); }
});

// DELETE /monthly-reviews/:id
monthlyRouter.delete('/:id', requireModule('pms_feedback', 'update'), async (req, res, next) => {
  try {
    const v = viewer(req);
    await assertTeam(v.id, v.role, [await ownerOf('monthlyreview', Number(req.params['id']))], 'You can delete feedback only for people in your team');
    await pms.deleteMonthly(Number(req.params['id']));
    res.type('text/plain').send('Monthly review deleted successfully');
  } catch (e) { next(e); }
});

// ── Quarterly Reviews ────────────────────────────────────────────────────────
const quarterlyRouter = Router();
quarterlyRouter.use(authenticate);

// POST  /quarterly-review/create
quarterlyRouter.post('/create', requireModule('pms_quarterly', 'create'), async (req, res, next) => {
  try {
    const v = viewer(req);
    await assertTeam(v.id, v.role, [Number(req.body?.empId)], 'You can review only people in your team');
    const id = await pms.createQuarterly(req.body);
    res.json({ success: true, message: 'Quarterly review saved successfully', id });
  } catch (e) { next(e); }
});

// GET   /quarterly-review/all
quarterlyRouter.get('/all', async (req, res, next) => {
  try {
    // everyone for Admin / Super Admin / PMS Report (HR); otherwise only the viewer's own and their team's reviews
    const v = viewer(req);
    const people = await readablePeople(v.id, v.role);
    const all = (await pms.listQuarterly()) as { empId?: number }[];
    res.json(people ? all.filter((r) => people.has(Number(r.empId))) : all);
  } catch (e) { next(e); }
});

// GET   /quarterly-review/employee/:empId?quarter=&year=
quarterlyRouter.get('/employee/:empId', async (req, res, next) => {
  try {
    const v = viewer(req);
    await assertCanRead(v.id, v.role, Number(req.params['empId']));
    res.json(await pms.listQuarterly(Number(req.params['empId']), req.query['quarter'] as string | undefined, req.query['year'] as string | undefined));
  } catch (e) { next(e); }
});

// PUT   /quarterly-review/update/:id
quarterlyRouter.put('/update/:id', requireModule('pms_quarterly', 'update'), async (req, res, next) => {
  try {
    const v = viewer(req);
    await assertTeam(v.id, v.role, [await ownerOf('quarterlyreview', Number(req.params['id']))], 'You can change reviews only for people in your team');
    const id = await pms.updateQuarterly(Number(req.params['id']), req.body);
    res.json({ success: true, message: 'Quarterly review updated successfully', id });
  } catch (e) { next(e); }
});

// The Quarterly Review screen also reads / deletes through the plural path
const quarterlyAliasRouter = Router();
quarterlyAliasRouter.use(authenticate);
quarterlyAliasRouter.get('/:empId', async (req, res, next) => {
  try {
    const v = viewer(req);
    await assertCanRead(v.id, v.role, Number(req.params['empId']));
    res.json(await pms.listQuarterly(Number(req.params['empId'])));
  } catch (e) { next(e); }
});
quarterlyAliasRouter.delete('/:id', requireModule('pms_quarterly', 'update'), async (req, res, next) => {
  try {
    const v = viewer(req);
    await assertTeam(v.id, v.role, [await ownerOf('quarterlyreview', Number(req.params['id']))], 'You can delete reviews only for people in your team');
    await pms.deleteQuarterly(Number(req.params['id'])); res.json({ success: true, message: 'Quarterly review deleted' }); } catch (e) { next(e); }
});

// ── Quarter notes: the employee's own biggest achievement and failure ─────────
const quarterReflectionRouter = Router();
quarterReflectionRouter.use(authenticate);

// GET /quarter-reflection/mine?year=  → the signed-in person's four quarters
quarterReflectionRouter.get('/mine', requireModule('pms_my_quarter'), async (req, res, next) => {
  try {
    const year = Number(req.query['year']) || new Date().getFullYear();
    res.json({ success: true, data: await reflection.listMine(Number(req.user!.sub), year) });
  } catch (e) { next(e); }
});

// PUT /quarter-reflection/mine  { quarter, year, biggestAchievement, biggestFailure }  → always the signed-in person's own
quarterReflectionRouter.put('/mine', requireModule('pms_my_quarter', 'update'), async (req, res, next) => {
  try { res.json({ success: true, data: await reflection.saveMine(Number(req.user!.sub), req.body ?? {}) }); } catch (e) { next(e); }
});

// GET /quarter-reflection/employee/:empId?quarter=&year=  → what the reviewer sees (read only)
quarterReflectionRouter.get('/employee/:empId', requireModule('pms_quarterly'), async (req, res, next) => {
  try {
    res.json({ success: true, data: await reflection.getFor(Number(req.params['empId']), String(req.query['quarter'] ?? ''), Number(req.query['year'])) });
  } catch (e) { next(e); }
});

// ── Goal Efficiency ──────────────────────────────────────────────────────────
const goalEfficiencyRouter = Router();
goalEfficiencyRouter.use(authenticate);

// POST  /goal-efficiency/calculate
goalEfficiencyRouter.post('/calculate', async (req, res, next) => {
  try { sendSuccess(res, await svc.calculateGoalEfficiency(req.body)); } catch (e) { next(e); }
});

// POST  /goal-efficiency/list
goalEfficiencyRouter.post('/list', async (req, res, next) => {
  try { sendSuccess(res, await svc.getGoalEfficiency(req.body)); } catch (e) { next(e); }
});

// ── PMS dashboard overview (company analytics) ───────────────────────────────
const pmsOverviewRouter = Router();
pmsOverviewRouter.use(authenticate, requireModule('pms_dashboard'));

// GET /pms-overview  → who should be reviewed, quarterly reviews, monthly manager feedback
pmsOverviewRouter.get('/', async (_req, res, next) => {
  try { res.json(await pmsOverview()); } catch (e) { next(e); }
});

export { monthlyRouter, quarterReflectionRouter, quarterlyRouter, quarterlyAliasRouter, goalEfficiencyRouter, pmsOverviewRouter };

// Default export for backward-compat (not used when app.ts imports named)
export default monthlyRouter;
