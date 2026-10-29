/**
 * UserGoalData routes — UserGoalDataController port
 * Base: /t2.0/authentificationUtilization/userGoalData
 */
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import { reviewStatusSummary } from '../reviews/pmsReviews.service';
import * as svc from './userGoalData.service';

const router = Router();
router.use(authenticate);

// The Goals page sends camelCase filters with nulls / 0 / NaN for "any"
const optId = z.preprocess((v) => (v === "" || v === 0 || (typeof v === "number" && Number.isNaN(v)) ? null : v), z.coerce.number().int().nullish());
const ListFilterSchema = z.object({
  userID: optId,
  departmentID: optId,
  goalID: optId,
  eLID: optId,
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  searchText: z.string().nullish(),
}).passthrough();

const RevisedGoalSchema = z.object({
  UserGoalDataID: z.number().int().positive(),
  RevisedGoal: z.number(),
  Reason: z.string().optional(),
});

const ReviewStatusFilterSchema = z.object({
  departmentID: z.number().int().positive().nullish(),
  filterType: z.string(),
  quarter: z.string().optional(),
  month: z.number().int().optional(),
  year: z.union([z.string(), z.number()]).transform(String).optional(),
});

// POST /userGoalData/list
router.post('/list', validate(ListFilterSchema), async (req, res, next) => {
  try {
    const page = req.query['page'] ? Number(req.query['page']) : undefined;
    const size = req.query['size'] ? Number(req.query['size']) : undefined;
    sendSuccess(res, await svc.listUserGoalData(req.body, page, size));
  } catch (e) { next(e); }
});

// PUT /userGoalData/revised-goal
router.put('/revised-goal', validate(RevisedGoalSchema), async (req, res, next) => {
  try {
    const userId = (req as Express.Request & { user?: { userID: number } }).user?.userID;
    sendSuccess(res, await svc.updateRevisedGoal(req.body, userId));
  } catch (e) { next(e); }
});

// POST /userGoalData/review-status
router.post('/review-status', validate(ReviewStatusFilterSchema), async (req, res, next) => {
  try { res.json(await reviewStatusSummary({ ...req.body, departmentID: req.body.departmentID ?? undefined })); } catch (e) { next(e); }
});

// GET /userGoalData/revised-goal/:userGoalDataID
router.get('/revised-goal/:userGoalDataID', async (req, res, next) => {
  try {
    sendSuccess(res, await svc.getRevisedGoalById(Number(req.params['userGoalDataID'])));
  } catch (e) { next(e); }
});

// GET /userGoalData/revised-goal?userId=&goalId=&workDate=
router.get('/revised-goal', async (req, res, next) => {
  try {
    const { userId, goalId, workDate } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getRevisedGoal(Number(userId), Number(goalId), workDate));
  } catch (e) { next(e); }
});

export default router;
