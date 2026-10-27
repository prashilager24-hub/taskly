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
  TargetType: z.string().optional(),
  TargetValue: z.number().optional(),
  StartDate: z.string().optional(),
  EndDate: z.string().optional(),
});

const EfficiencyQuerySchema = z.object({
  UserID: z.number().int().positive().optional(),
  DepartmentID: z.number().int().positive().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ── Java paths under /t2.0/authentificationUtilization/departmentTargets ──────

// POST /departmentTargets/create
router.post('/create', validate(CreateTargetSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createTarget(req.body), 201); } catch (e) { next(e); }
});

// PUT /departmentTargets/update/{targetID}
router.put('/update/:targetID', async (req, res, next) => {
  try { sendSuccess(res, await svc.updateTarget(Number(req.params['targetID']), req.body)); } catch (e) { next(e); }
});

// PUT /departmentTargets/{targetID}/status
router.put('/:targetID/status', async (req, res, next) => {
  try {
    sendSuccess(res, await svc.updateTargetStatus(Number(req.params['targetID']), req.body.status));
  } catch (e) { next(e); }
});

// POST /departmentTargets/getTargetsByDepartment
router.post('/getTargetsByDepartment', async (req, res, next) => {
  try { sendSuccess(res, await svc.getTargetsByDepartment(req.body.DepartmentID)); } catch (e) { next(e); }
});

// POST /departmentTargets/list
router.post('/list', async (req, res, next) => {
  try { sendSuccess(res, await svc.getTargetsByDepartment(req.body.DepartmentID)); } catch (e) { next(e); }
});

// GET /departmentTargets/monthly/:departmentId
router.get('/monthly/:departmentId', async (req, res, next) => {
  try { sendSuccess(res, await svc.getMonthlyTargets(Number(req.params['departmentId']))); } catch (e) { next(e); }
});

// POST /departmentTargets/efficiency/read
router.post('/efficiency/read', validate(EfficiencyQuerySchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.getEfficiencySummary(req.body)); } catch (e) { next(e); }
});

export default router;
