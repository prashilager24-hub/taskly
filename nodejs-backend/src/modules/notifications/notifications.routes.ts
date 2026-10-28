/** /t2.0/authentificationUtilization/notifications — admin sends, everyone receives what is meant for them */
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { requireModule } from '../../middlewares/permission';
import { validate } from '../../middlewares/validate';
import * as svc from './notifications.service';

const router = Router();
router.use(authenticate);

const me = (req: { user?: { sub: string } }) => Number(req.user?.sub);
const ok = (res: { json: (b: unknown) => unknown }, data: unknown) => res.json({ status: true, statusCode: 200, response: data });

// ── For everyone: the bell
router.get('/mine', async (req, res, next) => { try { ok(res, await svc.mine(me(req))); } catch (e) { next(e); } });
router.post('/read-all', async (req, res, next) => { try { await svc.markAll(me(req), 'read'); ok(res, true); } catch (e) { next(e); } });
router.post('/dismiss-all', async (req, res, next) => { try { await svc.markAll(me(req), 'dismiss'); ok(res, true); } catch (e) { next(e); } });
router.post('/:id/read', async (req, res, next) => { try { await svc.mark1(me(req), Number(req.params['id']), 'read'); ok(res, true); } catch (e) { next(e); } });
router.post('/:id/dismiss', async (req, res, next) => { try { await svc.mark1(me(req), Number(req.params['id']), 'dismiss'); ok(res, true); } catch (e) { next(e); } });

// ── For admins: compose and manage
const Body = z.object({
  title: z.string().min(1).max(160),
  body: z.string().max(2000).optional(),
  level: z.string().optional(),
  linkUrl: z.string().max(255).optional(),
  expiresAt: z.string().nullable().optional(),
  active: z.boolean().optional(),
  audience: z.object({ all: z.boolean().optional(), departments: z.array(z.number()).optional(), roles: z.array(z.number()).optional(), users: z.array(z.number()).optional() }),
});

router.get('/', requireModule('notifications', 'read'), async (_req, res, next) => { try { ok(res, await svc.list()); } catch (e) { next(e); } });
router.get('/audience-options', requireModule('notifications', 'read'), async (_req, res, next) => { try { ok(res, await svc.audienceOptions()); } catch (e) { next(e); } });
router.post('/reach', requireModule('notifications', 'read'), async (req, res, next) => { try { ok(res, { reach: await svc.reach(req.body?.audience ?? {}) }); } catch (e) { next(e); } });
router.post('/', requireModule('notifications', 'create'), validate(Body), async (req, res, next) => { try { ok(res, { id: await svc.create(me(req), req.body) }); } catch (e) { next(e); } });
router.put('/:id', requireModule('notifications', 'update'), validate(Body), async (req, res, next) => { try { await svc.update(Number(req.params['id']), req.body); ok(res, true); } catch (e) { next(e); } });
router.delete('/:id', requireModule('notifications', 'delete'), async (req, res, next) => { try { await svc.remove(Number(req.params['id'])); ok(res, true); } catch (e) { next(e); } });

export default router;
