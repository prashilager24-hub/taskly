import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import { sendJava } from '../../utils/javaCompat';
import * as svc from './tasks.service';

const router = Router();
router.use(authenticate);

// Request bodies mirror Java DepartmentTaskRequestDTO (camelCase, all optional)
const TaskSchema = z.object({
  departmentID: z.coerce.number().int().positive().nullish(),
  taskName: z.string().nullish(),
  standardTimeMins: z.coerce.number().nullish(),
  frequency: z.enum(['Daily', 'Weekly', 'Monthly', 'Dynamic', 'Not Daily']).nullish(),
  isDynamic: z.boolean().nullish(),
  description: z.string().nullish(),
  executiveLeaderID: z.number().nullish(),
  targetNumber: z.coerce.number().int().nullish(),
  isForTarget: z.boolean().nullish(),
  timingType: z.string().nullish(),
  roleID: z.coerce.number().int().nullish(),
});

const TaskListSchema = z.object({
  searchText: z.string().nullish(),
  filter: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
}).passthrough();

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

// These return the Java response bodies unwrapped — the frontend reads them directly.

// POST /departmentTasks/create
router.post('/create', validate(TaskSchema), async (req, res, next) => {
  try { sendJava(res, await svc.createDepartmentTask(req.body)); } catch (e) { next(e); }
});

// POST /departmentTasks/list?page=&size=&sortBy=
router.post('/list', validate(TaskListSchema), async (req, res, next) => {
  try {
    const page = Number(req.query['page'] ?? 1);
    const size = Number(req.query['size'] ?? 10);
    const sortBy = String(req.query['sortBy'] ?? 'modifiedAt');
    sendJava(res, await svc.getAllDepartmentTasks(req.body, page, size, sortBy));
  } catch (e) { next(e); }
});

// POST /departmentTasks/getTasksByDepartment  { departmentId }
router.post('/getTasksByDepartment', async (req, res, next) => {
  try {
    const departmentId = Number(req.body.departmentId);
    if (!Number.isInteger(departmentId)) {
      sendJava(res, { status: 'error', statusCode: 400, result: 'departmentId is required' }, 400);
      return;
    }
    sendJava(res, await svc.getTasksByDepartmentId(departmentId));
  } catch (e) { next(e); }
});

// PUT /departmentTasks/update/:id
router.put('/update/:id', validate(TaskSchema), async (req, res, next) => {
  try { sendJava(res, await svc.updateDepartmentTask(Number(req.params['id']), req.body)); } catch (e) { next(e); }
});

// PUT /departmentTasks/:taskID/status?isActive=true|false
router.put('/:taskID/status', async (req, res, next) => {
  try {
    const result = await svc.updateDepartmentTaskStatus(Number(req.params['taskID']), req.query['isActive'] === 'true');
    sendJava(res, result, result.statusCode);
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
