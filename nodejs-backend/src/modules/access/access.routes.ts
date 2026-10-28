/** /t2.0/authentificationUtilization/access — Access Management (roles, departments, users, two-factor) */
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { requireModule } from '../../middlewares/permission';
import { validate } from '../../middlewares/validate';
import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';
import * as svc from './access.service';

const router = Router();
router.use(authenticate);

const actor = (req: { user?: { sub: string } }) => Number(req.user?.sub);
const read = requireModule('accessmgmt', 'read');
const write = requireModule('accessmgmt', 'update');
const ok = (res: { json: (b: unknown) => unknown }, data: unknown) => res.json({ status: true, statusCode: 200, response: data });

// What the signed-in person can open. The frontend stores this and builds the menu and route guards from it.
router.get('/me', async (req, res, next) => {
  try {
    const userId = actor(req);
    const privileges = await svc.effectivePrivileges(userId);
    const [[u]] = await pool.execute<mysql.RowDataPacket[]>('SELECT r.RoleName FROM Users u LEFT JOIN AMRole r ON r.RoleID = u.RoleID WHERE u.UserID = ?', [userId]);
    ok(res, { roleName: u?.['RoleName'] ?? null, rolePrivileges: JSON.stringify(privileges), privileges });
  } catch (e) { next(e); }
});

router.get('/catalog', (_req, res) => ok(res, svc.catalog()));

// ── Roles
router.get('/roles', read, async (_req, res, next) => { try { ok(res, await svc.listRoles()); } catch (e) { next(e); } });

const RoleBody = z.object({ roleName: z.string().min(2), description: z.string().optional(), active: z.boolean().optional(), privileges: z.record(z.array(z.string())) });
router.post('/roles', requireModule('accessmgmt', 'create'), validate(RoleBody), async (req, res, next) => {
  try { ok(res, { roleId: await svc.saveRole(actor(req), req.body) }); } catch (e) { next(e); }
});
router.put('/roles/:id', write, validate(RoleBody), async (req, res, next) => {
  try { ok(res, { roleId: await svc.saveRole(actor(req), { ...req.body, roleId: Number(req.params['id']) }) }); } catch (e) { next(e); }
});
router.delete('/roles/:id', requireModule('accessmgmt', 'delete'), async (req, res, next) => {
  try { await svc.archiveRole(actor(req), Number(req.params['id'])); ok(res, { removed: true }); } catch (e) { next(e); }
});

// ── Departments
router.get('/departments', read, async (_req, res, next) => { try { ok(res, await svc.listDepartments()); } catch (e) { next(e); } });
router.put('/departments/:id', write, validate(z.object({ privileges: z.record(z.array(z.string())) })), async (req, res, next) => {
  try { await svc.setDepartmentAccess(actor(req), Number(req.params['id']), req.body.privileges); ok(res, { saved: true }); } catch (e) { next(e); }
});

// ── Users
router.get('/users', read, async (_req, res, next) => { try { ok(res, await svc.listUsers()); } catch (e) { next(e); } });
router.put('/users/two-factor', write, validate(z.object({ userIds: z.array(z.number().int()).min(1), value: z.enum(['default', 'on', 'off']) })), async (req, res, next) => {
  try { await svc.setUserTwoFactor(actor(req), req.body.userIds, req.body.value); ok(res, { saved: true }); } catch (e) { next(e); }
});

router.get('/users/:id', read, async (req, res, next) => { try { ok(res, await svc.explainUser(Number(req.params['id']))); } catch (e) { next(e); } });
router.put('/users/:id', write, validate(z.object({ grants: z.record(z.array(z.string())).optional(), denies: z.record(z.array(z.string())).optional() })), async (req, res, next) => {
  try { await svc.setUserAccess(actor(req), Number(req.params['id']), req.body); ok(res, await svc.explainUser(Number(req.params['id']))); } catch (e) { next(e); }
});
// ── Security
router.get('/security', read, async (_req, res, next) => { try { ok(res, await svc.security()); } catch (e) { next(e); } });
router.put('/security', write, validate(z.object({ twoFactorDefault: z.enum(['on', 'off']) })), async (req, res, next) => {
  try { await svc.setTwoFactorDefault(actor(req), req.body.twoFactorDefault); ok(res, await svc.security()); } catch (e) { next(e); }
});
router.get('/log', read, async (_req, res, next) => { try { ok(res, await svc.listLog()); } catch (e) { next(e); } });

export default router;
