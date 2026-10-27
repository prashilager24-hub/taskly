import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './targets.service';

const router = Router();
router.use(authenticate);

const CreateTargetSchema = z.object({
  DepartmentID: z.number().int().positive(),
  TargetName: z.string().min(2),
  TargetMetric: z.string(),
  Frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'SPRINT']),
});

const EfficiencyQuerySchema = z.object({
  UserID: z.number().int().positive().optional(),
  DepartmentID: z.number().int().positive().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  WorkType: z.enum(['DAILY', 'SPRINT']).optional(),
});

router.get('/department/:id', async (req, res, next) => {
  try { sendSuccess(res, await svc.getTargetsByDepartment(Number(req.params['id']))); } catch (e) { next(e); }
});
router.post('/', validate(CreateTargetSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createTarget(req.body), 201); } catch (e) { next(e); }
});
router.get('/monthly/:departmentId', async (req, res, next) => {
  try { sendSuccess(res, await svc.getMonthlyTargets(Number(req.params['departmentId']))); } catch (e) { next(e); }
});
router.post('/efficiency/read', validate(EfficiencyQuerySchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.getEfficiencySummary(req.body)); } catch (e) { next(e); }
});

export default router;
