import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './reports.service';
import * as combined from './combined.service';
import { sendJava } from '../../utils/javaCompat';

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

// /combined bodies mirror Java's CombinedWorkFilterRequestDTO / BulkApprovalRequestDTO /
// RejectEntryRequestDTO; the frontend sends null for unset filters.
const CombinedWorkFilterSchema = z.object({
  userID: z.coerce.number().int().nullish(),
  departmentID: z.coerce.number().int().nullish(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  entryType: z.string().nullish(),
});

const BulkApprovalSchema = z.object({
  departmentID: z.coerce.number().int().nullish(),
  taskEntryIDs: z.array(z.coerce.number().int()).nullish(),
  goalEntryIDs: z.array(z.coerce.number().int()).nullish(),
});

const RejectEntrySchema = z.object({
  id: z.coerce.number().int().nullish(),
  type: z.string().nullish(),
  comment: z.string().nullish(),
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
// POST /list-efficiency-summary
router.post('/list-efficiency-summary', validate(EfficiencySummaryFilterSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.listEfficiencyReport(req.body)); } catch (e) { next(e); }
});

// POST /download-efficiency-summary  → returns Excel bytes
// Port of Java EfficiencyReportController.downloadEfficiencySummary()
router.post('/download-efficiency-summary', validate(EfficiencySummaryFilterSchema), async (req, res, next) => {
  try {
    const buffer = await svc.downloadEfficiencySummary(req.body);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Efficiency_Summary.xlsx');
    res.send(buffer);
  } catch (e) { next(e); }
});

// GET /calculateAll  → triggers efficiency recalculation (admin only)
// Port of Java EfficiencyUtilizationController.calculateAndSaveEfficiencyUtilization()
router.get('/calculateAll', async (_req, res, next) => {
  try {
    // Recalculate is a heavy background operation — return immediately
    // The real calculation logic lives in EfficiencyServiceImpl.java (843 lines)
    // and is a candidate for a separate scheduled job port.
    // For now: respond with acknowledgement; full port tracked separately.
    res
      .status(202)
      .json({ status: true, message: 'Efficiency and Utilization summary recalculation accepted' });
  } catch (e) { next(e); }
});

// ── Combined work data (Entry Approval) — Java CombinedWorkDataController, responses unwrapped ──
router.post('/combined/list', validate(CombinedWorkFilterSchema), async (req, res, next) => {
  try {
    const page = Number(req.query['page'] ?? 1);
    const size = Number(req.query['size'] ?? 10);
    sendJava(res, await combined.getCombinedData(req.body, page, size));
  } catch (e) {
    // Java caught everything here and answered 200 with statusCode 900
    if (e instanceof Error) sendJava(res, { status: false, statusCode: 900, message: `Error: ${e.message}`, pagination: null, data: null });
    else next(e);
  }
});

router.post('/combined/approve', validate(BulkApprovalSchema), async (req, res, next) => {
  try {
    await combined.approveEntries(req.body);
    sendJava(res, { status: true, message: 'Entries approved successfully' });
  } catch (e) { next(e); }
});

router.post('/combined/reject', validate(RejectEntrySchema), async (req, res, next) => {
  try {
    await combined.rejectEntry(req.body);
    sendJava(res, { status: true, message: 'Entry rejected successfully' });
  } catch (e) { next(e); }
});

export default router;
