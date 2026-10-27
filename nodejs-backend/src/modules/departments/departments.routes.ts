import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { sendJava } from '../../utils/javaCompat';
import * as svc from './departments.service';

// Java exposed /Department/* and /PrimaryDepartment/* as two absolute paths, so there
// are two routers here (mounted in app.ts). Bodies are returned exactly as Java sent them.

const DepartmentSchema = z.object({
  departmentName: z.string().nullish(),
  departmentDescription: z.string().nullish(),
  executiveLeaderID: z.coerce.number().int().nullish(),
  functionalLeaderID: z.coerce.number().int().nullish(),
  primaryDepartmentId: z.coerce.number().int().nullish(),
});

const DepartmentListSchema = z.object({
  searchText: z.string().nullish(),
  filter: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  roleID: z.coerce.number().int().nullish(),
  userID: z.coerce.number().int().nullish(),
}).passthrough();

const IdListSchema = z.object({
  departmentIDList: z.array(z.coerce.number().int()).nullish(),
  departmentStatus: z.boolean().nullish(),
});

// Java's /Department/update answered 404/409 as-is and every other failure as 400;
// list/create/status/archive always answered HTTP 200 with the outcome in the body.
const updateHttpStatus = (code: number) => (code === 200 ? 200 : code === 404 || code === 409 ? code : 400);
const sendDto = (res: Response, body: unknown) => sendJava(res, body);

// ── /Department ──────────────────────────────────────────────────────────────
export const departmentsRouter = Router();
departmentsRouter.use(authenticate);

// POST /Department/list?page=&size=
departmentsRouter.post('/list', validate(DepartmentListSchema), async (req, res, next) => {
  try {
    sendDto(res, await svc.getAllDepartments(req.body, Number(req.query['page'] ?? 1), Number(req.query['size'] ?? 10)));
  } catch (e) { next(e); }
});

// POST /Department/create
departmentsRouter.post('/create', validate(DepartmentSchema), async (req, res, next) => {
  try { sendDto(res, await svc.createDepartment(req.body)); } catch (e) { next(e); }
});

// POST /Department/update/:id
departmentsRouter.post('/update/:id', validate(DepartmentSchema), async (req, res, next) => {
  try {
    const result = await svc.updateDepartment(Number(req.params['id']), req.body);
    sendJava(res, result, updateHttpStatus(result.statusCode));
  } catch (e) { next(e); }
});

// POST /Department/status { departmentIDList, departmentStatus }
departmentsRouter.post('/status', validate(IdListSchema), async (req, res, next) => {
  try { sendDto(res, await svc.updateDepartmentStatus(req.body)); } catch (e) { next(e); }
});

// POST /Department/archive { departmentIDList }
departmentsRouter.post('/archive', validate(IdListSchema), async (req, res, next) => {
  try { sendDto(res, await svc.updateDepartmentArchive(req.body)); } catch (e) { next(e); }
});

// GET /Department/taskTarget/:departmentId
departmentsRouter.get('/taskTarget/:departmentId', async (req, res, next) => {
  try { sendJava(res, await svc.getDepartmentTargetsAndTasks(Number(req.params['departmentId']))); } catch (e) { next(e); }
});

// GET /Department/hierarchy — Java wrapped this one in its ApiResponse { success, message, data, timestamp }
departmentsRouter.get('/hierarchy', async (_req, res, next) => {
  try {
    const data = await svc.getDepartmentHierarchy();
    sendJava(res, { success: true, message: 'Department hierarchy retrieved successfully', data, timestamp: new Date().toISOString() });
  } catch (e) { next(e); }
});

// ── /PrimaryDepartment ───────────────────────────────────────────────────────
export const primaryDepartmentsRouter = Router();
primaryDepartmentsRouter.use(authenticate);

primaryDepartmentsRouter.post('/create', async (req, res, next) => {
  try {
    const result = await svc.createPrimaryDepartment(req.body ?? {});
    sendJava(res, result, result.statusCode);
  } catch (e) { next(e); }
});

primaryDepartmentsRouter.post('/list', async (_req, res, next) => {
  try { sendJava(res, await svc.listPrimaryDepartments()); } catch (e) { next(e); }
});

primaryDepartmentsRouter.post('/update/:id', async (req, res, next) => {
  try {
    const result = await svc.updatePrimaryDepartment(Number(req.params['id']), req.body ?? {});
    sendJava(res, result, result.statusCode);
  } catch (e) { next(e); }
});

primaryDepartmentsRouter.post('/status', async (req, res, next) => {
  try {
    const result = await svc.updatePrimaryDepartmentStatus(req.body ?? {});
    sendJava(res, result, result.statusCode);
  } catch (e) { next(e); }
});
