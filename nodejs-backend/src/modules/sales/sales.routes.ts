/**
 * Sales routes — ports of:
 *   SalesCallController  → /t2.0/authentificationUtilization/sales/calls
 *   TACallController     → /t2.0/authentificationUtilization/ta/calls
 *   TAMAccountController → /t2.0/authentificationUtilization/tam
 *
 * All three routers exported; app.ts mounts each at its own sub-path.
 */
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './sales.service';

// ── SalesCalls (/sales/calls) ─────────────────────────────────────────────────
const salesCallsRouter = Router();
salesCallsRouter.use(authenticate);

const CreateSalesCallSchema = z.object({
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

const UpdateSalesStatusSchema = z.object({
  CallID: z.number().int().positive(),
  status: z.string(),
});

// POST /sales/calls/create
salesCallsRouter.post('/create', validate(CreateSalesCallSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.scheduleSalesCall(req.body), 201); } catch (e) { next(e); }
});

// POST /sales/calls/reschedule
salesCallsRouter.post('/reschedule', validate(RescheduleSalesCallSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.rescheduleSalesCall(req.body)); } catch (e) { next(e); }
});

// POST /sales/calls/update-status
salesCallsRouter.post('/update-status', validate(UpdateSalesStatusSchema), async (req, res, next) => {
  try {
    sendSuccess(res, await svc.updateSalesCallStatus(req.body.CallID, req.body.status));
  } catch (e) { next(e); }
});

// POST /sales/calls/list
salesCallsRouter.post('/list', async (req, res, next) => {
  try {
    sendSuccess(res, await svc.getSalesCalls(req.body));
  } catch (e) { next(e); }
});

// ── TACalls (/ta/calls) ───────────────────────────────────────────────────────
const taCallsRouter = Router();
taCallsRouter.use(authenticate);

const CreateTACallSchema = z.object({
  TAUserID: z.number().int().positive(),
  CandidateName: z.string().min(2),
  PositionID: z.number().int().positive(),
  ScheduledDatetime: z.string(),
});

const RescheduleTACallSchema = z.object({
  CallID: z.number().int().positive(),
  NewDatetime: z.string(),
  Reason: z.string().min(5),
  UserID: z.number().int().positive(),
});

const UpdateTAStatusSchema = z.object({
  CallID: z.number().int().positive(),
  status: z.string(),
});

// POST /ta/calls/create
taCallsRouter.post('/create', validate(CreateTACallSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.scheduleTACall(req.body), 201); } catch (e) { next(e); }
});

// POST /ta/calls/reschedule
taCallsRouter.post('/reschedule', validate(RescheduleTACallSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.rescheduleTACall(req.body)); } catch (e) { next(e); }
});

// POST /ta/calls/update-status
taCallsRouter.post('/update-status', validate(UpdateTAStatusSchema), async (req, res, next) => {
  try {
    sendSuccess(res, await svc.updateTACallStatus(req.body.CallID, req.body.status));
  } catch (e) { next(e); }
});

// POST /ta/calls/list
taCallsRouter.post('/list', async (req, res, next) => {
  try { sendSuccess(res, await svc.getTACalls(req.body)); } catch (e) { next(e); }
});

// ── TAM Accounts (/tam) ───────────────────────────────────────────────────────
const tamRouter = Router();
tamRouter.use(authenticate);

const CreateTAMSchema = z.object({
  AccountName: z.string().min(2),
  ContactPerson: z.string().optional(),
  ContactEmail: z.string().email().optional(),
  TAMUserID: z.number().int().positive().optional(),
  Status: z.string().optional(),
});

const UpdateTAMSchema = z.object({
  AccountID: z.number().int().positive(),
  AccountName: z.string().min(2).optional(),
  ContactPerson: z.string().optional(),
  ContactEmail: z.string().email().optional(),
  TAMUserID: z.number().int().positive().optional(),
  Status: z.string().optional(),
});

// POST /tam/create
tamRouter.post('/create', validate(CreateTAMSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createTAMAccount(req.body), 201); } catch (e) { next(e); }
});

// PUT  /tam/update
tamRouter.put('/update', validate(UpdateTAMSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.updateTAMAccount(req.body)); } catch (e) { next(e); }
});

// GET  /tam/list
tamRouter.get('/list', async (req, res, next) => {
  try {
    sendSuccess(res, await svc.getTAMAccounts(req.query['status'] as string | undefined));
  } catch (e) { next(e); }
});

export { salesCallsRouter, taCallsRouter, tamRouter };
export default salesCallsRouter;
