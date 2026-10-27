/**
 * Form routes — UserWorkDataController port
 * Base: /t2.0/authentificationUtilization/form
 */
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './form.service';

const router = Router();
router.use(authenticate);

const BulkCreateSchema = z.object({
  activities: z.array(z.object({
    UserID: z.number().int().positive(),
    DepartmentID: z.number().int().positive(),
    TaskID: z.number().int().positive(),
    WorkDate: z.string(),
    AllocatedTime: z.number().optional(),
    TimeTakenToWork: z.number().optional(),
    AchivedUnits: z.number().optional(),
    TaskMeta: z.record(z.unknown()).optional(),
    LeaveType: z.string().optional(),
    RevisedTarget: z.number().optional(),
  })).min(1),
});

const BulkWorkSchema = z.object({
  UserID: z.number().int().positive().optional(),
  DepartmentID: z.number().int().positive().optional(),
  WorkDate: z.string().optional(),
  LeaveType: z.string().optional(),
  activities: z.array(z.record(z.unknown())).optional(),
  goals: z.array(z.record(z.unknown())).optional(),
});

const ListFilterSchema = z.object({
  UserID: z.number().int().positive().optional(),
  DepartmentID: z.number().int().positive().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  TaskID: z.number().int().optional(),
});

const RevisedTargetSchema = z.object({
  DailyTaskLogID: z.number().int().positive(),
  RevisedTarget: z.number(),
  Reason: z.string().optional(),
});

// POST /form/bulkCreate
router.post('/bulkCreate', validate(BulkCreateSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.bulkCreateWorkData(req.body.activities), 201); } catch (e) { next(e); }
});

// POST /form/bulkWork
router.post('/bulkWork', validate(BulkWorkSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.bulkWork(req.body)); } catch (e) { next(e); }
});

// POST /form/list
router.post('/list', validate(ListFilterSchema), async (req, res, next) => {
  try {
    const page = req.query['page'] ? Number(req.query['page']) : undefined;
    const size = req.query['size'] ? Number(req.query['size']) : undefined;
    const sortBy = req.query['sortBy'] as string | undefined;
    sendSuccess(res, await svc.listWorkData(req.body, page, size, sortBy));
  } catch (e) { next(e); }
});

// PATCH /form/bulkUpdate
router.patch('/bulkUpdate', validate(BulkWorkSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.bulkUpdateWorkData(req.body)); } catch (e) { next(e); }
});

// PUT /form/revised-target
router.put('/revised-target', validate(RevisedTargetSchema), async (req, res, next) => {
  try {
    const userId = (req as Express.Request & { user?: { userID: number } }).user?.userID;
    sendSuccess(res, await svc.updateRevisedTarget(req.body, userId));
  } catch (e) { next(e); }
});

// GET /form/revised-target/:dailyTaskLogID
router.get('/revised-target/:dailyTaskLogID', async (req, res, next) => {
  try {
    sendSuccess(res, await svc.getRevisedTargetByLogId(Number(req.params['dailyTaskLogID'])));
  } catch (e) { next(e); }
});

// GET /form/revised-target?userID=&taskID=&workDate=
router.get('/revised-target', async (req, res, next) => {
  try {
    const { userID, taskID, workDate, isForTarget } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getRevisedTarget(
      Number(userID), Number(taskID), workDate, isForTarget === 'true',
    ));
  } catch (e) { next(e); }
});

// PUT /form/goal/update
router.put('/goal/update', async (req, res, next) => {
  try { sendSuccess(res, await svc.updateGoalAchievement(req.body)); } catch (e) { next(e); }
});

export default router;
