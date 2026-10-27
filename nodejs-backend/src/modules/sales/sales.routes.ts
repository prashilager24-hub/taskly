import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './sales.service';

const router = Router();
router.use(authenticate);

const ScheduleSalesCallSchema = z.object({
  CreaterUserID: z.number().int().positive(),
  PublisherName: z.string().min(2),
  SalesUserID: z.number().int().positive(),
  ScheduledDatetime: z.string(),
});

const RescheduleSalesCallSchema = z.object({
  CallID: z.number().int().positive(),
  NewDatetime: z.string(),
  Reason: z.string().min(5),
  UserID: z.number().int().positive(),
});

const ScheduleTACallSchema = z.object({
  TAUserID: z.number().int().positive(),
  CandidateName: z.string().min(2),
  PositionID: z.number().int().positive(),
  ScheduledDatetime: z.string(),
});

// Sales calls
router.get('/calls', async (req, res, next) => {
  try {
    const { SalesUserID, status, fromDate, toDate } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getSalesCalls({
      SalesUserID: SalesUserID ? Number(SalesUserID) : undefined, status, fromDate, toDate,
    }));
  } catch (e) { next(e); }
});
router.post('/calls', validate(ScheduleSalesCallSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.scheduleSalesCall(req.body), 201); } catch (e) { next(e); }
});
router.patch('/calls/:id/status', async (req, res, next) => {
  try { sendSuccess(res, await svc.updateSalesCallStatus(Number(req.params['id']), req.body.status)); } catch (e) { next(e); }
});
router.post('/calls/reschedule', validate(RescheduleSalesCallSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.rescheduleSalesCall(req.body)); } catch (e) { next(e); }
});

// TA calls
router.get('/ta-calls', async (req, res, next) => {
  try {
    const { TAUserID, Status } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getTACalls({ TAUserID: TAUserID ? Number(TAUserID) : undefined, Status }));
  } catch (e) { next(e); }
});
router.post('/ta-calls', validate(ScheduleTACallSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.scheduleTACall(req.body), 201); } catch (e) { next(e); }
});
router.patch('/ta-calls/:id/status', async (req, res, next) => {
  try { sendSuccess(res, await svc.updateTACallStatus(Number(req.params['id']), req.body.status)); } catch (e) { next(e); }
});

// TAM accounts
router.get('/tam', async (req, res, next) => {
  try { sendSuccess(res, await svc.getTAMAccounts(req.query['status'] as string)); } catch (e) { next(e); }
});

export default router;
