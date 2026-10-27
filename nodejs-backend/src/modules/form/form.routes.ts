import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { sendJava } from '../../utils/javaCompat';
import * as svc from './form.service';

/**
 * Form routes — port of Java UserWorkDataController
 * Base: /t2.0/authentificationUtilization/form
 * Request bodies are camelCase as the frontend sends them; responses are Java's, unwrapped.
 */

const router = Router();
router.use(authenticate);

const num = z.coerce.number();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const WorkEntrySchema = z.object({
  dailyTaskLogID: num.int().nullish(),
  taskID: num.int().nullish(),
  userID: num.int().nullish(),
  workDate: date.nullish(),
  setUp: num.int().nullish(),
  allocatedTime: num.nullish(),
  timeTakenToWork: num.nullish(),
  isForTarget: z.boolean().nullish(),
  overAllTime: num.nullish(),
  remarks: z.string().nullish(),
  units: num.nullish(),
  departmentID: num.int().nullish(),
  achivedUnits: num.int().nullish(),
  totalUnitValues: z.string().nullish(),
  targetID: num.int().nullish(),
  totalTimePerSetup: num.nullish(),
  isHalfDayLeave: z.boolean().nullish(),
  leaveType: z.string().nullish(),
  taskMeta: z.array(num.int()).nullish(),
}).passthrough();

const GoalEntrySchema = z.object({
  userGoalDataID: num.int().nullish(),
  workDate: date.nullish(),
  userID: num.int().nullish(),
  departmentID: num.int().nullish(),
  goalID: num.int().nullish(),
  fixedGoal: num.nullish(),
  achievedGoal: num.nullish(),
  goalType: z.string().nullish(),
  comment: z.string().nullish(),
  metaData: z.array(z.record(z.unknown())).nullish(),
}).passthrough();

const WorkAndGoalSchema = z.object({
  leaveType: z.string().nullish(),
  userID: num.int().nullish(),
  departmentID: num.int().nullish(),
  workDate: date.nullish(),
  activities: z.array(WorkEntrySchema).nullish(),
  goals: z.array(GoalEntrySchema).nullish(),
});

// The frontend sends "" / null for unset filters
const optInt = z.preprocess((v) => (v === '' ? null : v), num.int().nullish());
const optDate = z.preprocess((v) => (v === '' ? null : v), date.nullish());

const ListFilterSchema = z.object({
  userID: optInt,
  roleID: optInt,
  departmentID: optInt,
  startDate: optDate,
  endDate: optDate,
  isForTarget: z.boolean().nullish(),
  taskID: optInt,
  eLID: optInt,
}).passthrough();

const RevisedTargetSchema = z.object({
  dailyTaskLogID: num.int().nullish(),
  userID: num.int().nullish(),
  taskID: num.int().nullish(),
  workDate: date.nullish(),
  isForTarget: z.boolean().nullish(),
  revisedTarget: z.object({
    value: num.nullish(),
    enteredBy: num.int().nullish(),
    enteredAt: z.string().nullish(),
    elApproved: z.boolean().nullish(),
    approvedBy: num.int().nullish(),
    approvedAt: z.string().nullish(),
    comment: z.string().nullish(),
  }).nullish(),
  action: z.string().nullish(),
  clear: z.boolean().nullish(),
});

const GoalUpdateSchema = z.object({
  userId: num.int(),
  goalId: num.int(),
  achievedGoal: num.nullish(),
  workDate: date,
  comment: z.string().nullish(),
});

// POST /form/bulkCreate — body is a bare array of entries
router.post('/bulkCreate', validate(z.array(WorkEntrySchema)), async (req, res, next) => {
  try { sendJava(res, await svc.bulkCreateUserWorkData(req.body)); } catch (e) { next(e); }
});

// POST /form/bulkWork — a day's activities + goals, or a FULL_DAY leave
router.post('/bulkWork', validate(WorkAndGoalSchema), async (req, res, next) => {
  try {
    const { httpStatus, body } = await svc.bulkWork(req.body);
    res.status(httpStatus).type('text/plain').send(body);
  } catch (e) { next(e); }
});

// POST /form/list?page=&size=&sortBy= — without page/size returns every row
router.post('/list', validate(ListFilterSchema), async (req, res, next) => {
  try {
    const page = Number(req.query['page'] ?? 0);
    const size = Number(req.query['size'] ?? 0);
    const result = page > 0 && size > 0
      ? await svc.listPaginated(req.body, page, size, req.query['sortBy'] as string | undefined)
      : await svc.listAll(req.body);
    sendJava(res, result);
  } catch (e) { next(e); }
});

// PATCH /form/bulkUpdate
router.patch('/bulkUpdate', validate(WorkAndGoalSchema), async (req, res, next) => {
  try {
    await svc.bulkUpdateWorkAndGoals(req.body);
    res.type('text/plain').send('Updated Successfully');
  } catch (e) { next(e); }
});

// PUT /form/revised-target
router.put('/revised-target', validate(RevisedTargetSchema), async (req, res, next) => {
  try { sendJava(res, await svc.updateRevisedTarget(req.body, Number(req.user!.sub))); } catch (e) { next(e); }
});

// GET /form/revised-target/:dailyTaskLogID
router.get('/revised-target/:dailyTaskLogID', async (req, res, next) => {
  try { sendJava(res, await svc.getRevisedTarget({ dailyTaskLogID: Number(req.params['dailyTaskLogID']) })); } catch (e) { next(e); }
});

// GET /form/revised-target?userID=&taskID=&workDate=&isForTarget=
router.get('/revised-target', async (req, res, next) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    sendJava(res, await svc.getRevisedTarget({
      userID: q['userID'] ? Number(q['userID']) : null,
      taskID: q['taskID'] ? Number(q['taskID']) : null,
      workDate: q['workDate'] ?? null,
      isForTarget: q['isForTarget'] == null ? null : q['isForTarget'] === 'true',
    }));
  } catch (e) { next(e); }
});

// PUT /form/goal/update
router.put('/goal/update', validate(GoalUpdateSchema), async (req, res, next) => {
  try { sendJava(res, await svc.updateGoal(req.body)); } catch (e) { next(e); }
});

export default router;
