import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './tasks.service';

const router = Router();
router.use(authenticate);

const CreateTaskSchema = z.object({
  DepartmentID: z.number().int().positive(),
  TaskName: z.string().min(2),
  StandardTimeMins: z.number().positive(),
  Frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'SPRINT']),
  IsForTarget: z.boolean().default(false),
});

const UpdateTaskSchema = z.object({
  TaskID: z.number().int().positive(),
  TaskName: z.string().optional(),
  StandardTimeMins: z.number().positive().optional(),
  Frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'SPRINT']).optional(),
  IsForTarget: z.boolean().optional(),
});

const LogWorkSchema = z.object({
  TaskID: z.number().int().positive(),
  UserID: z.number().int().positive(),
  WorkDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  AllocatedTime: z.number().positive(),
  TimeTakenToWork: z.number().positive(),
  DepartmentID: z.number().int().positive(),
  AchivedUnits: z.number().min(0),
  TaskMeta: z.record(z.unknown()).optional(),
  RevisedTarget: z.number().optional(),
});

const WorkDataQuerySchema = z.object({
  UserID: z.number().int().positive().optional(),
  DepartmentID: z.number().int().positive().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const LogLeaveSchema = z.object({
  UserID: z.number().int().positive(),
  WorkDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  LeaveType: z.enum(['HALF_DAY', 'FULL_DAY']),
});

// ── Java paths under /t2.0/authentificationUtilization/departmentTasks ────────

// POST /departmentTasks/create
router.post('/create', validate(CreateTaskSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createTask(req.body), 201); } catch (e) { next(e); }
});

// POST /departmentTasks/list
router.post('/list', async (req, res, next) => {
  try { sendSuccess(res, await svc.getTasksByDepartment(req.body.DepartmentID)); } catch (e) { next(e); }
});

// POST /departmentTasks/getTasksByDepartment
router.post('/getTasksByDepartment', async (req, res, next) => {
  try { sendSuccess(res, await svc.getTasksByDepartment(req.body.DepartmentID)); } catch (e) { next(e); }
});

// PUT /departmentTasks/update/{id}
router.put('/update/:id', validate(UpdateTaskSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.updateTask(req.body)); } catch (e) { next(e); }
});

// PUT /departmentTasks/{taskID}/status
router.put('/:taskID/status', async (req, res, next) => {
  try {
    sendSuccess(res, await svc.updateTaskStatus(Number(req.params['taskID']), req.body.status));
  } catch (e) { next(e); }
});

// ── Convenience routes kept from prior implementation ─────────────────────────
router.post('/work/log', validate(LogWorkSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.logWork(req.body), 201); } catch (e) { next(e); }
});
router.post('/work/read', validate(WorkDataQuerySchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.getWorkData(req.body)); } catch (e) { next(e); }
});
router.post('/leave/log', validate(LogLeaveSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.logLeave(req.body), 201); } catch (e) { next(e); }
});
router.get('/leave/:userID', async (req, res, next) => {
  try {
    const { from = '', to = '' } = req.query as { from?: string; to?: string };
    sendSuccess(res, await svc.getUserLeave(Number(req.params['userID']), from, to));
  } catch (e) { next(e); }
});

export default router;
