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

// ── Monthly Reviews (Java contract: camelCase DTOs, plain arrays) ────────────
const monthlyRouter = Router();
monthlyRouter.use(authenticate);

// POST  /monthly-reviews
monthlyRouter.post('/', async (req, res, next) => {
  try { res.status(201).json(await pms.createMonthly(req.body)); } catch (e) { next(e); }
});

// GET   /monthly-reviews/:empId/:year   (year may be ALL)
monthlyRouter.get('/:empId/:year', async (req, res, next) => {
  try { res.json(await pms.listMonthly(Number(req.params['empId']), String(req.params['year']))); } catch (e) { next(e); }
});

// DELETE /monthly-reviews/:id
monthlyRouter.delete('/:id', async (req, res, next) => {
  try {
    await pms.deleteMonthly(Number(req.params['id']));
    res.type('text/plain').send('Monthly review deleted successfully');
  } catch (e) { next(e); }
});

// ── Quarterly Reviews ────────────────────────────────────────────────────────
const quarterlyRouter = Router();
quarterlyRouter.use(authenticate);

// POST  /quarterly-review/create
quarterlyRouter.post('/create', async (req, res, next) => {
  try {
    const id = await pms.createQuarterly(req.body);
    res.json({ success: true, message: 'Quarterly review saved successfully', id });
  } catch (e) { next(e); }
});

// GET   /quarterly-review/all
quarterlyRouter.get('/all', async (_req, res, next) => {
  try { res.json(await pms.listQuarterly()); } catch (e) { next(e); }
});

// GET   /quarterly-review/employee/:empId?quarter=&year=
quarterlyRouter.get('/employee/:empId', async (req, res, next) => {
  try {
    res.json(await pms.listQuarterly(Number(req.params['empId']), req.query['quarter'] as string | undefined, req.query['year'] as string | undefined));
  } catch (e) { next(e); }
});

// PUT   /quarterly-review/update/:id
quarterlyRouter.put('/update/:id', async (req, res, next) => {
  try {
    const id = await pms.updateQuarterly(Number(req.params['id']), req.body);
    res.json({ success: true, message: 'Quarterly review updated successfully', id });
  } catch (e) { next(e); }
});

// The Quarterly Review screen also reads / deletes through the plural path
const quarterlyAliasRouter = Router();
quarterlyAliasRouter.use(authenticate);
quarterlyAliasRouter.get('/:empId', async (req, res, next) => {
  try { res.json(await pms.listQuarterly(Number(req.params['empId']))); } catch (e) { next(e); }
});
quarterlyAliasRouter.delete('/:id', async (req, res, next) => {
  try { await pms.deleteQuarterly(Number(req.params['id'])); res.json({ success: true, message: 'Quarterly review deleted' }); } catch (e) { next(e); }
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

export { monthlyRouter, quarterlyRouter, quarterlyAliasRouter, goalEfficiencyRouter };

// Default export for backward-compat (not used when app.ts imports named)
export default monthlyRouter;
