/** /t2.0/authentificationUtilization/dept-mgmt — Department Management (departments, sub departments, their people) */
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { requireModule } from '../../middlewares/permission';
import { validate } from '../../middlewares/validate';
import * as svc from './deptmgmt.service';

const router = Router();
router.use(authenticate);

const read = requireModule('deptmgmt', 'read');
const create = requireModule('deptmgmt', 'create');
const write = requireModule('deptmgmt', 'update');
const ok = (res: { json: (b: unknown) => unknown }, data: unknown) => res.json({ status: true, statusCode: 200, response: data });
const id = (v: unknown) => Number(v);

const person = z.number().int().positive().nullable().optional();
const Sub = z.object({ name: z.string().trim().min(2).max(120), elId: person, flId: person, description: z.string().max(500).nullable().optional() });
const Department = z.object({
  name: z.string().trim().min(2).max(150), type: z.enum(svc.TYPES), goalCriteria: z.enum(svc.CRITERIA), targetCriteria: z.enum(svc.CRITERIA),
  description: z.string().max(500).nullable().optional(), subDepartments: z.array(Sub).max(30).nullable().optional(), elId: person, flId: person,
});
const DepartmentPatch = Department.omit({ subDepartments: true, elId: true, flId: true }).partial().extend({ active: z.boolean().optional() });
const NewSub = Sub.extend({ departmentId: z.number().int().positive().nullable(), people: z.array(z.number().int().positive()).max(200).optional(), copyFrom: z.number().int().positive().nullable().optional() });
const SubPatch = Sub.partial().extend({ departmentId: z.number().int().positive().nullable().optional(), active: z.boolean().optional() });
const People = z.object({ userIds: z.array(z.number().int().positive()).min(1).max(200) });
const Mapping = z.object({ items: z.array(z.object({ subDepartmentId: z.number().int().positive(), departmentId: z.number().int().positive() })).min(1) });

router.get('/', read, async (_req, res, next) => { try { ok(res, await svc.overview()); } catch (e) { next(e); } });

router.get('/departments/:id', read, async (req, res, next) => { try { ok(res, await svc.department(id(req.params['id']))); } catch (e) { next(e); } });
router.post('/departments', create, validate(Department), async (req, res, next) => { try { ok(res, await svc.createDepartment(req.body)); } catch (e) { next(e); } });
router.put('/departments/:id', write, validate(DepartmentPatch), async (req, res, next) => { try { ok(res, await svc.updateDepartment(id(req.params['id']), req.body)); } catch (e) { next(e); } });

router.get('/sub-departments/:id', read, async (req, res, next) => { try { ok(res, await svc.subDepartment(id(req.params['id']))); } catch (e) { next(e); } });
router.post('/sub-departments', create, validate(NewSub), async (req, res, next) => { try { ok(res, await svc.createSubDepartment(req.body)); } catch (e) { next(e); } });
router.put('/sub-departments/:id', write, validate(SubPatch), async (req, res, next) => { try { ok(res, await svc.updateSubDepartment(id(req.params['id']), req.body)); } catch (e) { next(e); } });
router.delete('/sub-departments/:id', write, async (req, res, next) => { try { ok(res, await svc.removeSubDepartment(id(req.params['id']))); } catch (e) { next(e); } });
router.post('/sub-departments/:id/people', write, validate(People), async (req, res, next) => { try { ok(res, await svc.addPeople(id(req.params['id']), req.body.userIds)); } catch (e) { next(e); } });

router.put('/mapping', write, validate(Mapping), async (req, res, next) => { try { ok(res, await svc.mapSubDepartments(req.body.items)); } catch (e) { next(e); } });

export default router;
