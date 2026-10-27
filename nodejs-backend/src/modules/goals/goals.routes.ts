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
  GoalType: z.string().optional(),
  TargetValue: z.number().optional(),
  StartDate: z.string().optional(),
  EndDate: z.string().optional(),
});

const PmsGoalSchema = z.object({
  UserID: z.number().int().positive(),
  GoalTitle: z.string().min(2),
  Description: z.string().optional(),
  TargetDate: z.string().optional(),
});

const LogGoalSchema = z.object({
  GoalID: z.number().int().positive(),
  UserID: z.number().int().positive(),
  WorkDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  AchievedValue: z.number().min(0),
  Notes: z.string().optional(),
});

const GoalDataQuerySchema = z.object({
  UserID: z.number().int().positive().optional(),
  DepartmentID: z.number().int().positive().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ── Java paths under /t2.0/authentificationUtilization/departmentGoals ────────

// POST /departmentGoals/create
router.post('/create', validate(CreateGoalSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createGoal(req.body), 201); } catch (e) { next(e); }
});

// PUT /departmentGoals/update/{goalID}
router.put('/update/:goalID', async (req, res, next) => {
  try { sendSuccess(res, await svc.updateGoal(Number(req.params['goalID']), req.body)); } catch (e) { next(e); }
});

// PUT /departmentGoals/{goalID}/status
router.put('/:goalID/status', async (req, res, next) => {
  try {
    sendSuccess(res, await svc.updateGoalStatus(Number(req.params['goalID']), req.body.status));
  } catch (e) { next(e); }
});

// POST /departmentGoals/getGoalsByDepartment
router.post('/getGoalsByDepartment', async (req, res, next) => {
  try { sendSuccess(res, await svc.getGoalsByDepartment(req.body.DepartmentID)); } catch (e) { next(e); }
});

// PUT /departmentGoals/approve
router.put('/approve', async (req, res, next) => {
  try { sendSuccess(res, await svc.approveGoal(req.body)); } catch (e) { next(e); }
});

// POST /departmentGoals/list
router.post('/list', async (req, res, next) => {
  try { sendSuccess(res, await svc.getGoalsByDepartment(req.body.DepartmentID)); } catch (e) { next(e); }
});

// Goal data logging
router.post('/data/log', validate(LogGoalSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.logGoalData(req.body), 201); } catch (e) { next(e); }
});
router.post('/data/read', validate(GoalDataQuerySchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.getGoalData(req.body)); } catch (e) { next(e); }
});

// PMS goals
router.get('/pms', async (req, res, next) => {
  try {
    const userId = req.query['userId'] ? Number(req.query['userId']) : undefined;
    sendSuccess(res, await svc.getPmsGoals({ UserID: userId }));
  } catch (e) { next(e); }
});
router.post('/pms', validate(PmsGoalSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createPmsGoal(req.body), 201); } catch (e) { next(e); }
});
router.patch('/pms/:id/status', async (req, res, next) => {
  try { sendSuccess(res, await svc.updatePmsGoalStatus(Number(req.params['id']), req.body.status)); } catch (e) { next(e); }
});

export default router;
