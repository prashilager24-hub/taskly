import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import {
  CreateDepartmentSchema, UpdateDepartmentSchema,
} from './departments.schema';
import * as ctrl from './departments.controller';
import { sendSuccess } from '../../utils/response';
import * as svc from './departments.service';

const router = Router();
router.use(authenticate);

// ── Java paths under /t2.0/authentificationUtilization/Department ─────────────

// POST /Department/list
router.post('/list', ctrl.list);

// POST /Department/create
router.post('/create', validate(CreateDepartmentSchema), ctrl.create);

// POST /Department/update/{id}
router.post('/update/:id', validate(UpdateDepartmentSchema), ctrl.update);

// POST /Department/status
router.post('/status', async (req, res, next) => {
  try {
    const { DepartmentID, IsActive } = req.body as { DepartmentID: number; IsActive: boolean };
    sendSuccess(res, await svc.updateDepartmentStatus(DepartmentID, IsActive));
  } catch (e) { next(e); }
});

// POST /Department/archive
router.post('/archive', async (req, res, next) => {
  try {
    const { DepartmentID, IsArchive } = req.body as { DepartmentID: number; IsArchive: boolean };
    sendSuccess(res, await svc.archiveDepartment(DepartmentID, IsArchive));
  } catch (e) { next(e); }
});

// GET /Department/taskTarget/:departmentId
router.get('/taskTarget/:departmentId', async (req, res, next) => {
  try {
    sendSuccess(res, await svc.getDepartmentTaskTarget(Number(req.params['departmentId'])));
  } catch (e) { next(e); }
});

// GET /Department/hierarchy
router.get('/hierarchy', async (_req, res, next) => {
  try { sendSuccess(res, await svc.getDepartmentHierarchy()); } catch (e) { next(e); }
});

// GET /Department/:id/users  (bonus helper)
router.get('/:id/users', ctrl.getUsers);

// ── PrimaryDepartment routes (same base router, different prefix) ─────────────
// POST /Department/PrimaryDepartment/create
router.post('/PrimaryDepartment/create', async (req, res, next) => {
  try { sendSuccess(res, await svc.createPrimaryDepartment(req.body), 201); } catch (e) { next(e); }
});

// POST /Department/PrimaryDepartment/list
router.post('/PrimaryDepartment/list', ctrl.primaryList);

// POST /Department/PrimaryDepartment/update/{id}
router.post('/PrimaryDepartment/update/:id', async (req, res, next) => {
  try {
    sendSuccess(res, await svc.updatePrimaryDepartment(Number(req.params['id']), req.body));
  } catch (e) { next(e); }
});

// POST /Department/PrimaryDepartment/status
router.post('/PrimaryDepartment/status', async (req, res, next) => {
  try {
    const { PrimaryDepartmentID, IsActive } = req.body as { PrimaryDepartmentID: number; IsActive: boolean };
    sendSuccess(res, await svc.updatePrimaryDepartmentStatus(PrimaryDepartmentID, IsActive));
  } catch (e) { next(e); }
});

export default router;
