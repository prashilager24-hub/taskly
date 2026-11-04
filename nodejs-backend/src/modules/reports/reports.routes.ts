import { Router } from 'express';
import { calculateAndSaveDailyEfficiency } from '../../jobs/efficiencyCalculation';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './reports.service';
import * as combined from './combined.service';
import * as effSummary from './efficiencySummary.service';
import { sendJava } from '../../utils/javaCompat';

const router = Router();
router.use(authenticate);

// The dashboard sends null for unset filters plus fields this port doesn't use yet (goal dates)
const optNum = z.preprocess((v) => (v === "" ? null : v), z.coerce.number().int().nullish());
const DashBoardFilterSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  userID: optNum,
  departmentID: optNum,
  elID: optNum,
  flID: optNum,
  roleID: optNum,
  isHeExecutiveLeader: z.boolean().nullish(),
  isHeFunctionalLeader: z.boolean().nullish(),
}).passthrough();

const EfficiencySummaryFilterSchema = z.object({
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  userID: optNum,
  departmentID: optNum,
  eLID: optNum,
  elID: optNum,
  groupBy: z.string().nullish(),
  efficiencyLevel: z.string().nullish(),
  isHeExecutiveLeader: z.boolean().nullish(),
  targetByDepartment: z.boolean().nullish(),
  filters: z.array(z.object({ field: z.string(), operator: z.string(), value: z.coerce.string() })).nullish(),
}).passthrough();

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
  id: z.coerce.number().int(),
  type: z.string().nullish(),
  comment: z.string().trim().min(1, 'Enter a reason for rejecting'),
});

const viewer = (req: { user?: { sub?: string | number; role?: number } }) => ({ id: Number(req.user?.sub), role: Number(req.user?.role) });

// ── Dashboard routes (same path as Java: /t2.0/authentificationUtilization/) ─
// Mounted under /t2.0/reports so React proxy can reach them
router.post('/DashBoard', validate(DashBoardFilterSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.listEfficiencySummary(req.body)); } catch (e) { next(e); }
});

// Java returned the map unwrapped — the dashboard reads res.data.elSummary etc.
router.post('/DashBoardAll', validate(DashBoardFilterSchema), async (req, res, next) => {
  try { sendJava(res, await svc.listEfficiencySummaryNewData(req.body)); } catch (e) { next(e); }
});

// ── Efficiency report ─────────────────────────────────────────────────────────
// POST /list-efficiency-summary
// Java returned { data, summary } (or { departments } for an EL) unwrapped
router.post('/list-efficiency-summary', validate(EfficiencySummaryFilterSchema), async (req, res, next) => {
  try { sendJava(res, await effSummary.listEfficiencySummary({ ...req.body, eLID: req.body.eLID ?? req.body.elID })); } catch (e) { next(e); }
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

// GET /calculateAll  → rebuilds the efficiency and utilization summary (also runs every day at 6:00 AM IST)
// Port of Java EfficiencyUtilizationController.calculateAndSaveEfficiencyUtilization()
router.get('/calculateAll', async (_req, res, next) => {
  try {
    const result = await calculateAndSaveDailyEfficiency();
    if (result.skipped) { res.status(202).send(result.reason); return; }
    res.status(200).send(' Efficiency and Utilization summary calculated and saved successfully.');
  } catch (e) { next(e); }
});

// ── Combined work data (Entry Approval) — Java CombinedWorkDataController, responses unwrapped ──
router.post('/combined/list', validate(CombinedWorkFilterSchema), async (req, res, next) => {
  try {
    const page = Number(req.query['page'] ?? 1);
    const size = Number(req.query['size'] ?? 10);
    // only the viewer's own entries and their team's (everyone for Admin / Super Admin)
    const v = viewer(req);
    const team = await combined.teamOf(v.id, v.role);
    const allowed = team === 'all' ? null : [v.id, ...team];
    if (allowed && req.body.userID != null && !allowed.includes(Number(req.body.userID))) req.body.userID = -1;
    sendJava(res, await combined.getCombinedData({ ...req.body, onlyUsers: allowed }, page, size));
  } catch (e) {
    // Java caught everything here and answered 200 with statusCode 900
    if (e instanceof Error) sendJava(res, { status: false, statusCode: 900, message: `Error: ${e.message}`, pagination: null, data: null });
    else next(e);
  }
});

router.post('/combined/approve', validate(BulkApprovalSchema), async (req, res, next) => {
  try {
    const v = viewer(req);
    await combined.assertCanDecide(v.id, v.role, req.body.taskEntryIDs ?? [], req.body.goalEntryIDs ?? []);
    await combined.approveEntries(req.body);
    sendJava(res, { status: true, message: 'Entries approved successfully' });
  } catch (e) { next(e); }
});

router.post('/combined/reject', validate(RejectEntrySchema), async (req, res, next) => {
  try {
    const v = viewer(req);
    const goal = String(req.body.type ?? '').toLowerCase() === 'goal';
    await combined.assertCanDecide(v.id, v.role, goal ? [] : [req.body.id], goal ? [req.body.id] : []);
    await combined.rejectEntry(req.body);
    sendJava(res, { status: true, message: 'Entry rejected successfully' });
  } catch (e) { next(e); }
});

export default router;
