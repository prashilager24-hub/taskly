import { Router, type Response } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './goals.service';
import * as dg from './departmentGoals.service';
import { sendJava } from '../../utils/javaCompat';

const router = Router();
router.use(authenticate);

// Request bodies mirror Java DepartmentGoalRequestDTO (camelCase, all optional)
const GoalSchema = z.object({
  departmentID: z.coerce.number().int().positive().nullish(),
  goalName: z.string().nullish(),
  goalMetric: z.string().nullish(),
  metricValue: z.union([z.string(), z.number()]).transform(String).nullish(),
  liveAccounts: z.coerce.number().int().nullish(),
  unit: z.string().nullish(),
  frequency: z.enum(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Dynamic', 'Not Daily']).nullish(),
  timingType: z.string().nullish(),
  isDynamic: z.boolean().nullish(),
  description: z.string().nullish(),
  isActive: z.boolean().nullish(),
  roleID: z.coerce.number().int().nullish(),
});

const DeptItemListSchema = z.object({
  searchText: z.string().nullish(),
  filter: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
}).passthrough();

const ApproveGoalsSchema = z.object({
  goalIds: z.array(z.number().int()).nullish(),
  userId: z.number().int().nullish(),
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

// These return the Java response bodies unwrapped, with Java's HTTP status
// (the controller used ResponseEntity.status(statusCode)) — the frontend reads them directly.
const sendDto = (res: Response, body: { statusCode: number }) => sendJava(res, body, body.statusCode);

// POST /departmentGoals/create
router.post('/create', validate(GoalSchema), async (req, res, next) => {
  try { sendDto(res, await dg.createDepartmentGoal(req.body)); } catch (e) { next(e); }
});

// PUT /departmentGoals/update/:goalID
router.put('/update/:goalID', validate(GoalSchema), async (req, res, next) => {
  try { sendDto(res, await dg.updateDepartmentGoal(Number(req.params['goalID']), req.body)); } catch (e) { next(e); }
});

// PUT /departmentGoals/:goalID/status?isActive=true|false
router.put('/:goalID/status', async (req, res, next) => {
  try {
    sendDto(res, await dg.updateDepartmentGoalStatus(Number(req.params['goalID']), req.query['isActive'] === 'true'));
  } catch (e) { next(e); }
});

// POST /departmentGoals/getGoalsByDepartment  { departmentId, roleId }
router.post('/getGoalsByDepartment', async (req, res, next) => {
  try {
    sendDto(res, await dg.getGoalsByDepartmentId(Number(req.body.departmentId ?? 0) || 0, Number(req.body.roleId ?? 0) || 0));
  } catch (e) { next(e); }
});

// PUT /departmentGoals/approve  { goalIds, userId }
router.put('/approve', validate(ApproveGoalsSchema), async (req, res, next) => {
  try { sendDto(res, await dg.approveGoals(req.body)); } catch (e) { next(e); }
});

// POST /departmentGoals/list?page=&size=&sortBy=
router.post('/list', validate(DeptItemListSchema), async (req, res, next) => {
  try {
    const page = Number(req.query['page'] ?? 1);
    const size = Number(req.query['size'] ?? 10);
    sendDto(res, await dg.getAllDepartmentGoals(req.body, page, size, String(req.query['sortBy'] ?? 'modifiedAt')));
  } catch (e) { next(e); }
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
