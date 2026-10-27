import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './admin.service';

const router = Router();
router.use(authenticate);

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

// Admin Tasks — role 1 (SuperAdmin) only
router.get('/tasks', authorize(1), async (req, res, next) => {
  try {
    const { status, assigned_to, created_by } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getAdminTasks({
      status,
      assigned_to: assigned_to ? Number(assigned_to) : undefined,
      created_by: created_by ? Number(created_by) : undefined,
    }));
  } catch (e) { next(e); }
});
router.get('/tasks/:id', authorize(1), async (req, res, next) => {
  try { sendSuccess(res, await svc.getAdminTaskById(Number(req.params['id']))); } catch (e) { next(e); }
});
router.post('/tasks', authorize(1), validate(CreateAdminTaskSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createAdminTask(req.body), 201); } catch (e) { next(e); }
});
router.put('/tasks', authorize(1), validate(UpdateAdminTaskSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.updateAdminTask(req.body)); } catch (e) { next(e); }
});
router.delete('/tasks/:id', authorize(1), async (req, res, next) => {
  try { sendSuccess(res, await svc.deleteAdminTask(Number(req.params['id']))); } catch (e) { next(e); }
});

// Job Positions — roles 1 & 2 (SuperAdmin, Admin)
router.get('/positions', async (req, res, next) => {
  try {
    const deptId = req.query['DepartmentID'] ? Number(req.query['DepartmentID']) : undefined;
    sendSuccess(res, await svc.getJobPositions(deptId));
  } catch (e) { next(e); }
});
router.post('/positions', authorize(1, 2), validate(CreateJobPositionSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createJobPosition(req.body), 201); } catch (e) { next(e); }
});
router.put('/positions', authorize(1, 2), validate(UpdateJobPositionSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.updateJobPosition(req.body)); } catch (e) { next(e); }
});
router.delete('/positions/:id', authorize(1, 2), async (req, res, next) => {
  try { sendSuccess(res, await svc.deleteJobPosition(Number(req.params['id']))); } catch (e) { next(e); }
});

// Audit logs — role 1 only
router.get('/audit', authorize(1), async (req, res, next) => {
  try {
    const { userId, action, limit } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getAuditLogs({
      userId: userId ? Number(userId) : undefined,
      action,
      limit: limit ? Number(limit) : undefined,
    }));
  } catch (e) { next(e); }
});

export default router;
