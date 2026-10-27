import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './reviews.service';

const router = Router();
router.use(authenticate);

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

router.get('/monthly', async (req, res, next) => {
  try {
    const { emp_id, month, year } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getMonthlyReviews({
      emp_id: emp_id ? Number(emp_id) : undefined,
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    }));
  } catch (e) { next(e); }
});
router.post('/monthly', validate(MonthlyReviewSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.upsertMonthlyReview(req.body)); } catch (e) { next(e); }
});
router.get('/quarterly', async (req, res, next) => {
  try {
    const { emp_id, quarter, year } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getQuarterlyReviews({
      emp_id: emp_id ? Number(emp_id) : undefined,
      quarter,
      year: year ? Number(year) : undefined,
    }));
  } catch (e) { next(e); }
});
router.post('/quarterly', validate(QuarterlyReviewSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.upsertQuarterlyReview(req.body)); } catch (e) { next(e); }
});
router.get('/goal-efficiency', async (req, res, next) => {
  try {
    const { UserID, DepartmentID } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getGoalEfficiency({
      UserID: UserID ? Number(UserID) : undefined,
      DepartmentID: DepartmentID ? Number(DepartmentID) : undefined,
    }));
  } catch (e) { next(e); }
});

export default router;
