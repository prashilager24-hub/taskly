import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './goals.service';

const router = Router();
router.use(authenticate);

const CreateGoalSchema = z.object({
  DepartmentID: z.number().int().positive(),
  GoalName: z.string().min(2),
  GoalMetric: z.enum(['PERCENTAGE', 'COUNT', 'VALUE']),
  Frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'SPRINT']),
  IsDynamic: z.boolean().default(false),
  approvedByEL: z.boolean().default(false),
});

const LogGoalSchema = z.object({
  WorkDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  UserID: z.number().int().positive(),
  DepartmentID: z.number().int().positive(),
  GoalID: z.number().int().positive(),
  FixedGoal: z.number(),
  AchievedGoal: z.number(),
  metadata: z.record(z.unknown()).optional(),
  RevisedGoal: z.number().optional(),
});

const GoalDataQuerySchema = z.object({
  UserID: z.number().int().positive().optional(),
  DepartmentID: z.number().int().positive().optional(),
  GoalID: z.number().int().positive().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const PmsGoalSchema = z.object({
  UserID: z.number().int().positive(),
  DepartmentID: z.number().int().positive(),
  GoalID: z.number().int().positive(),
  Quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
  GoalYear: z.number().int().min(2020),
  GoalTitle: z.string().min(2),
  Weight: z.number().min(0).max(100),
});

router.get('/department/:id', async (req, res, next) => {
  try { sendSuccess(res, await svc.getGoalsByDepartment(Number(req.params['id']))); } catch (e) { next(e); }
});
router.post('/', validate(CreateGoalSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createGoal(req.body), 201); } catch (e) { next(e); }
});
router.post('/data/log', validate(LogGoalSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.logGoalData(req.body), 201); } catch (e) { next(e); }
});
router.post('/data/read', validate(GoalDataQuerySchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.getGoalData(req.body)); } catch (e) { next(e); }
});
router.get('/pms', async (req, res, next) => {
  try {
    const { UserID, DepartmentID, Quarter, GoalYear } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getPmsGoals({
      UserID: UserID ? Number(UserID) : undefined,
      DepartmentID: DepartmentID ? Number(DepartmentID) : undefined,
      Quarter,
      GoalYear: GoalYear ? Number(GoalYear) : undefined,
    }));
  } catch (e) { next(e); }
});
router.post('/pms', validate(PmsGoalSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createPmsGoal(req.body), 201); } catch (e) { next(e); }
});
router.patch('/pms/:id/status', async (req, res, next) => {
  try { sendSuccess(res, await svc.updatePmsGoalStatus(Number(req.params['id']), req.body.status)); } catch (e) { next(e); }
});

export default router;
