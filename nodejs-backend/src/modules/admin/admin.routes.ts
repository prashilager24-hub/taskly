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

const CreateJobPositionSchema = z.object({
  PositionName: z.string().min(2),
  DepartmentID: z.number().int().positive().optional(),
  description: z.string().optional(),
});

const UpdateJobPositionSchema = z.object({
  PositionID: z.number().int().positive(),
  PositionName: z.string().min(2).optional(),
  DepartmentID: z.number().int().positive().optional(),
  description: z.string().optional(),
});

// POST /positions/create
positionsRouter.post('/create', authorize(1, 2), validate(CreateJobPositionSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createJobPosition(req.body), 201); } catch (e) { next(e); }
});

// GET  /positions/list
positionsRouter.get('/list', async (req, res, next) => {
  try {
    const deptId = req.query['DepartmentID'] ? Number(req.query['DepartmentID']) : undefined;
    sendSuccess(res, await svc.getJobPositions(deptId));
  } catch (e) { next(e); }
});

// PUT  /positions/update
positionsRouter.put('/update', authorize(1, 2), validate(UpdateJobPositionSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.updateJobPosition(req.body)); } catch (e) { next(e); }
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
