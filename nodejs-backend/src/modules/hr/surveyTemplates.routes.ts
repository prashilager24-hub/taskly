import { Router, type Request } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { AppError } from '../../utils/AppError';
import { can } from '../access/access.service';
import * as svc from './surveyTemplates.service';

// /hrFeedback/templates: survey templates. Anyone signed in can list the active ones (HR picks one when sending a survey);
// adding, editing and turning them on or off needs the template permission of that kind (HR team by default).
const router = Router();
router.use(authenticate);

const ok = (data: unknown, status = 200) => ({ status, body: { success: true, data, timestamp: new Date().toISOString() } });
const userId = (req: Request) => Number(req.user!.sub);
const moduleOf = (kind: svc.TemplateKind) => (kind === 'ONBOARDING' ? 'hr_onb_templates' : 'hr_eng_templates');

async function allow(req: Request, kind: svc.TemplateKind, action: 'read' | 'create' | 'update') {
  if (!(await can(userId(req), moduleOf(kind), action))) throw AppError.forbidden('You do not have access to manage these survey templates');
}

const Question = z.object({
  section: z.string().max(150).nullish(),
  text: z.string().max(500),
  short: z.string().max(60).nullish(),
  kind: z.enum(['RATING', 'MONTHLY', 'TEXT']),
});
const TemplateBody = z.object({
  kind: z.enum(['ONBOARDING', 'ENGAGEMENT']),
  name: z.string().max(150),
  description: z.string().max(300).nullish(),
  questions: z.array(Question).min(1).max(40),
});

// GET /templates?kind=ONBOARDING&all=1   (all = include turned-off ones, for the manager)
router.get('/', async (req, res, next) => {
  try {
    const kind = req.query['kind'] === 'ENGAGEMENT' ? 'ENGAGEMENT' : req.query['kind'] === 'ONBOARDING' ? 'ONBOARDING' : undefined;
    const all = req.query['all'] === '1';
    if (all && kind) await allow(req, kind, 'read');
    const r = ok({ templates: await svc.listTemplates(kind, all && !!kind) });
    res.status(r.status).json(r.body);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const t = await svc.getTemplate(Number(req.params['id']));
    await allow(req, t.kind, 'read');
    const r = ok(t); res.status(r.status).json(r.body);
  } catch (e) { next(e); }
});

router.post('/', validate(TemplateBody), async (req, res, next) => {
  try {
    await allow(req, req.body.kind, 'create');
    const r = ok(await svc.saveTemplate(userId(req), req.body), 201); res.status(r.status).json(r.body);
  } catch (e) { next(e); }
});

router.put('/:id', validate(TemplateBody), async (req, res, next) => {
  try {
    await allow(req, req.body.kind, 'update');
    const r = ok(await svc.saveTemplate(userId(req), { ...req.body, id: Number(req.params['id']) })); res.status(r.status).json(r.body);
  } catch (e) { next(e); }
});

router.put('/:id/active', validate(z.object({ active: z.boolean() })), async (req, res, next) => {
  try {
    const t = await svc.getTemplate(Number(req.params['id']));
    await allow(req, t.kind, 'update');
    const r = ok(await svc.setActive(t.id, req.body.active)); res.status(r.status).json(r.body);
  } catch (e) { next(e); }
});

router.put('/:id/default', async (req, res, next) => {
  try {
    const t = await svc.getTemplate(Number(req.params['id']));
    await allow(req, t.kind, 'update');
    const r = ok(await svc.setDefault(t.id)); res.status(r.status).json(r.body);
  } catch (e) { next(e); }
});

export default router;
