/**
 * Admin routes — ports of:
 *   AdminController      → /t2.0/authentificationUtilization/adminTickets
 *   JobPositionController→ /t2.0/authentificationUtilization/positions
 *
 * Both routers exported; app.ts mounts each at its own sub-path.
 * Legacy adminRouter kept for backward-compat (audit logs, general admin tasks).
 */
import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './admin.service';
import * as positions from './positions.service';
import { sendJava } from '../../utils/javaCompat';

// ── Admin Tickets (/adminTickets) ─────────────────────────────────────────────
const adminTicketsRouter = Router();
adminTicketsRouter.use(authenticate);

const CreateTicketSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  created_by: z.number().int().positive(),
  assigned_to: z.number().int().positive().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  due_date: z.string().optional(),
});

const UpdateTicketSchema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  assigned_to: z.number().int().positive().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  due_date: z.string().optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED']).optional(),
});

// POST /adminTickets/create
adminTicketsRouter.post('/create', validate(CreateTicketSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createAdminTask(req.body), 201); } catch (e) { next(e); }
});

// GET  /adminTickets/list
adminTicketsRouter.get('/list', async (req, res, next) => {
  try {
    const { status, assigned_to, created_by } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getAdminTasks({
      status,
      assigned_to: assigned_to ? Number(assigned_to) : undefined,
      created_by: created_by ? Number(created_by) : undefined,
    }));
  } catch (e) { next(e); }
});

// PUT  /adminTickets/update
adminTicketsRouter.put('/update', validate(UpdateTicketSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.updateAdminTask(req.body)); } catch (e) { next(e); }
});

// ── Job Positions (/positions) ────────────────────────────────────────────────
const positionsRouter = Router();
positionsRouter.use(authenticate);

// Bodies mirror Java's PositionCreateRequest / PositionUpdateRequest; dates are "dd-MM-yyyy".
// Responses are Java's, unwrapped. Java had no role check here — HR (dept 22) manages
// positions — so access rules are left to the Access Management work.
const PositionCreateSchema = z.object({
  positionName: z.string().nullish(),
  jdDetails: z.string().nullish(),
  userID: z.coerce.number().int().nullish(),
  openDate: z.string().nullish(),
});

const PositionUpdateSchema = PositionCreateSchema.extend({
  positionID: z.coerce.number().int(),
  status: z.string().nullish(),
  pausedDate: z.string().nullish(),
  closeDate: z.string().nullish(),
});

// POST /positions/create
positionsRouter.post('/create', validate(PositionCreateSchema), async (req, res, next) => {
  try { sendJava(res, await positions.createPosition(req.body)); } catch (e) { next(e); }
});

// GET  /positions/list?page=&size=&sortBy=&sortDirection=&userId=&status=
// page=0&size=0 → the user's own positions as a bare array; otherwise all positions, paged
positionsRouter.get('/list', async (req, res, next) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const page = Number(q['page'] ?? 1);
    const size = Number(q['size'] ?? 10);
    const status = q['status'] ?? 'all';
    const result = page === 0 && size === 0
      ? await positions.listForUser(Number(q['userId'] ?? 0), status)
      : await positions.listPaged(page, size, q['sortBy'] ?? 'positionID', q['sortDirection'] ?? 'ASC', status);
    sendJava(res, result);
  } catch (e) { next(e); }
});

// PUT  /positions/update
positionsRouter.put('/update', validate(PositionUpdateSchema), async (req, res, next) => {
  try { sendJava(res, await positions.updatePosition(req.body)); } catch (e) { next(e); }
});

// ── Legacy admin router (kept for audit, etc.) ────────────────────────────────
const adminRouter = Router();
adminRouter.use(authenticate);

const CreateAdminTaskSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  created_by: z.number().int().positive(),
  assigned_to: z.number().int().positive().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  due_date: z.string().optional(),
});

const UpdateAdminTaskSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  assigned_to: z.number().int().positive().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  due_date: z.string().optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED']).optional(),
});

adminRouter.get('/tasks', authorize(1), async (req, res, next) => {
  try {
    const { status, assigned_to, created_by } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getAdminTasks({
      status,
      assigned_to: assigned_to ? Number(assigned_to) : undefined,
      created_by: created_by ? Number(created_by) : undefined,
    }));
  } catch (e) { next(e); }
});
adminRouter.get('/tasks/:id', authorize(1), async (req, res, next) => {
  try { sendSuccess(res, await svc.getAdminTaskById(Number(req.params['id']))); } catch (e) { next(e); }
});
adminRouter.post('/tasks', authorize(1), validate(CreateAdminTaskSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createAdminTask(req.body), 201); } catch (e) { next(e); }
});
adminRouter.put('/tasks', authorize(1), validate(UpdateAdminTaskSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.updateAdminTask(req.body)); } catch (e) { next(e); }
});
adminRouter.delete('/tasks/:id', authorize(1), async (req, res, next) => {
  try { sendSuccess(res, await svc.deleteAdminTask(Number(req.params['id']))); } catch (e) { next(e); }
});
adminRouter.get('/audit', authorize(1), async (req, res, next) => {
  try {
    const { userId, action, limit } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getAuditLogs({
      userId: userId ? Number(userId) : undefined,
      action,
      limit: limit ? Number(limit) : undefined,
    }));
  } catch (e) { next(e); }
});

export { adminTicketsRouter, positionsRouter };
export default adminRouter;
