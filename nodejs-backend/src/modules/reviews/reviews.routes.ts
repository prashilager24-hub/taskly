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
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './reviews.service';

// ── Monthly Reviews ──────────────────────────────────────────────────────────
const monthlyRouter = Router();
monthlyRouter.use(authenticate);

const MonthlyReviewSchema = z.object({
  emp_id: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  target: z.number().optional(),
  goal: z.number().optional(),
  utilization: z.number().optional(),
  efficiency: z.number().optional(),
  feedback: z.record(z.unknown()).optional(),
  accessor: z.record(z.unknown()).optional(),
});

// POST  /monthly-reviews          → upsert
monthlyRouter.post('/', validate(MonthlyReviewSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.upsertMonthlyReview(req.body)); } catch (e) { next(e); }
});

// GET   /monthly-reviews/:empId/:year
monthlyRouter.get('/:empId/:year', async (req, res, next) => {
  try {
    sendSuccess(res, await svc.getMonthlyReviews({
      emp_id: Number(req.params['empId']),
      year: Number(req.params['year']),
    }));
  } catch (e) { next(e); }
});

// DELETE /monthly-reviews/:id
monthlyRouter.delete('/:id', async (req, res, next) => {
  try { sendSuccess(res, await svc.deleteMonthlyReview(Number(req.params['id']))); } catch (e) { next(e); }
});

// ── Quarterly Reviews ────────────────────────────────────────────────────────
const quarterlyRouter = Router();
quarterlyRouter.use(authenticate);

const QuarterlyReviewSchema = z.object({
  emp_id: z.number().int().positive(),
  quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
  quarter_year: z.number().int().min(2020),
  target_percent: z.number().optional(),
  goal_achievement: z.number().optional(),
  system_grade: z.string().optional(),
  manager_avg_rating: z.number().optional(),
  final_rating: z.number().optional(),
  manager_ratings: z.record(z.unknown()).optional(),
  feedback: z.record(z.unknown()).optional(),
  grade: z.record(z.unknown()).optional(),
});

const QuarterlyUpdateSchema = QuarterlyReviewSchema.partial().extend({
  id: z.number().int().positive(),
});

// POST  /quarterly-review/create
quarterlyRouter.post('/create', validate(QuarterlyReviewSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.upsertQuarterlyReview(req.body), 201); } catch (e) { next(e); }
});

// GET   /quarterly-review/all
quarterlyRouter.get('/all', async (_req, res, next) => {
  try { sendSuccess(res, await svc.getQuarterlyReviews({})); } catch (e) { next(e); }
});

// GET   /quarterly-review/employee/:empId
quarterlyRouter.get('/employee/:empId', async (req, res, next) => {
  try {
    sendSuccess(res, await svc.getQuarterlyReviews({ emp_id: Number(req.params['empId']) }));
  } catch (e) { next(e); }
});

// PUT   /quarterly-review/update/:id
quarterlyRouter.put('/update/:id', validate(QuarterlyUpdateSchema), async (req, res, next) => {
  try {
    sendSuccess(res, await svc.upsertQuarterlyReview({ ...req.body, id: Number(req.params['id']) }));
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

export { monthlyRouter, quarterlyRouter, goalEfficiencyRouter };

// Default export for backward-compat (not used when app.ts imports named)
export default monthlyRouter;
