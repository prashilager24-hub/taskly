import { Router, type Response } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './targets.service';
import * as dt from './departmentTargets.service';
import { sendJava } from '../../utils/javaCompat';

const router = Router();
router.use(authenticate);

// Request bodies mirror Java DepartmentTargetRequestDTO (camelCase, all optional)
const TargetSchema = z.object({
  departmentID: z.coerce.number().int().positive().nullish(),
  targetName: z.string().nullish(),
  targetMetric: z.string().nullish(),
  metricValue: z.union([z.string(), z.number()]).transform(String).nullish(),
  unit: z.string().nullish(),
  frequency: z.enum(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Dynamic', 'Not Daily']).nullish(),
  timingType: z.string().nullish(),
  isDynamic: z.boolean().nullish(),
  description: z.string().nullish(),
  isActive: z.boolean().nullish(),
  roleID: z.coerce.number().int().nullish(),
  roleIds: z.array(z.coerce.number().int()).nullish(),
}).passthrough();

const DeptItemListSchema = z.object({
  searchText: z.string().nullish(),
  filter: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
}).passthrough();

const EfficiencyQuerySchema = z.object({
  UserID: z.number().int().positive().optional(),
  DepartmentID: z.number().int().positive().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ── Java paths under /t2.0/authentificationUtilization/departmentTargets ──────

// These return the Java response bodies unwrapped, with Java's HTTP status
// (the controller used ResponseEntity.status(statusCode)) — the frontend reads them directly.
const sendDto = (res: Response, body: { statusCode: number }) => sendJava(res, body, body.statusCode);

// POST /departmentTargets/create
router.post('/create', validate(TargetSchema), async (req, res, next) => {
  try { sendDto(res, await dt.createDepartmentTarget(req.body)); } catch (e) { next(e); }
});

// PUT /departmentTargets/update/:targetID
router.put('/update/:targetID', validate(TargetSchema), async (req, res, next) => {
  try { sendDto(res, await dt.updateDepartmentTarget(Number(req.params['targetID']), req.body)); } catch (e) { next(e); }
});

// PUT /departmentTargets/:targetID/status?isActive=true|false
router.put('/:targetID/status', async (req, res, next) => {
  try {
    sendDto(res, await dt.updateDepartmentTargetStatus(Number(req.params['targetID']), req.query['isActive'] === 'true'));
  } catch (e) { next(e); }
});

// POST /departmentTargets/getTargetsByDepartment  { departmentId, roleId }
router.post('/getTargetsByDepartment', async (req, res, next) => {
  try {
    sendDto(res, await dt.getTargetsByDepartmentId(Number(req.body.departmentId ?? 0) || 0, Number(req.body.roleId ?? 0) || 0));
  } catch (e) { next(e); }
});

// POST /departmentTargets/list?page=&size=&sortBy=
router.post('/list', validate(DeptItemListSchema), async (req, res, next) => {
  try {
    const page = Number(req.query['page'] ?? 1);
    const size = Number(req.query['size'] ?? 10);
    sendDto(res, await dt.getAllDepartmentTargets(req.body, page, size, String(req.query['sortBy'] ?? 'modifiedAt')));
  } catch (e) { next(e); }
});

// GET /departmentTargets/monthly/:departmentId
router.get('/monthly/:departmentId', async (req, res, next) => {
  try { sendSuccess(res, await svc.getMonthlyTargets(Number(req.params['departmentId']))); } catch (e) { next(e); }
});

// POST /departmentTargets/efficiency/read
router.post('/efficiency/read', validate(EfficiencyQuerySchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.getEfficiencySummary(req.body)); } catch (e) { next(e); }
});

export default router;
