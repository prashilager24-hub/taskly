import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './reports.service';

const router = Router();
router.use(authenticate);

const DashBoardFilterSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  userID: z.number().int().positive().optional(),
  departmentID: z.number().int().optional(),
  elID: z.number().int().optional(),
  flID: z.number().int().optional(),
  roleID: z.number().int().optional(),
  isHeExecutiveLeader: z.boolean().optional(),
  isHeFunctionalLeader: z.boolean().optional(),
});

const EfficiencySummaryFilterSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  userID: z.number().int().optional(),
  departmentID: z.number().int().optional(),
  elID: z.number().int().optional(),
  isHeExecutiveLeader: z.boolean().optional(),
});

const CombinedWorkFilterSchema = z.object({
  userID: z.number().int().optional(),
  departmentID: z.number().int().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  entryType: z.enum(['TASK', 'TARGET', 'GOAL']).optional(),
});

const BulkApprovalSchema = z.object({
  entryIDs: z.array(z.number().int().positive()).min(1),
  approvedBy: z.number().int().positive(),
});

const RejectEntrySchema = z.object({
  entryID: z.number().int().positive(),
  reason: z.string().min(5),
  rejectedBy: z.number().int().positive(),
});

// ── Dashboard routes (same path as Java: /t2.0/authentificationUtilization/) ─
// Mounted under /t2.0/reports so React proxy can reach them
router.post('/DashBoard', validate(DashBoardFilterSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.listEfficiencySummary(req.body)); } catch (e) { next(e); }
});

router.post('/DashBoardAll', validate(DashBoardFilterSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.listEfficiencySummaryNewData(req.body)); } catch (e) { next(e); }
});

// ── Efficiency report ─────────────────────────────────────────────────────────
router.post('/list-efficiency-summary', validate(EfficiencySummaryFilterSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.listEfficiencyReport(req.body)); } catch (e) { next(e); }
});

// ── Combined work data ────────────────────────────────────────────────────────
router.post('/combined/list', validate(CombinedWorkFilterSchema), async (req, res, next) => {
  try {
    const page = Number(req.query['page'] ?? 1);
    const size = Number(req.query['size'] ?? 10);
    sendSuccess(res, await svc.getCombinedWorkData(req.body, page, size));
  } catch (e) { next(e); }
});

router.post('/combined/approve', validate(BulkApprovalSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.approveWorkEntries(req.body)); } catch (e) { next(e); }
});

router.post('/combined/reject', validate(RejectEntrySchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.rejectWorkEntry(req.body)); } catch (e) { next(e); }
});

export default router;
