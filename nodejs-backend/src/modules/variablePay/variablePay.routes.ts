/** /t2.0/authentificationUtilization/variable-pay — People Hub → Variable Pay (see variablePay.service.ts: appeal → Finance Head → paid) */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { requireModule } from '../../middlewares/permission';
import { validate } from '../../middlewares/validate';
import { AppError } from '../../utils/AppError';
import { sendSuccess } from '../../utils/response';
import * as svc from './variablePay.service';

const router = Router();
router.use(authenticate);

const who = (req: Request) => ({ id: Number(req.user?.sub), role: Number(req.user?.role) });
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-01-31');
const money = z.coerce.number().min(0).max(1e9);
const wrap = (fn: (req: Request) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { fn(req).then((d) => sendSuccess(res, d)).catch(next); };
/** Finance Review: Admin, the Finance role(s) and the Finance Head */
const financeOnly = (req: Request, _res: Response, next: NextFunction) => {
  const v = who(req);
  svc.canFinance(v.id, v.role).then((ok) => (ok ? next() : next(AppError.forbidden('Only the Finance Head or an Admin can do this')))).catch(next);
};

// ── My Variable Pay ──
router.get('/me', requireModule('hub_variable_pay_my'), wrap((req) => svc.mine(who(req).id)));
router.post('/me/send', requireModule('hub_variable_pay_my', 'create'), validate(z.object({ periodKey: z.string().min(2).max(16), note: z.string().max(2000).nullish() })),
  wrap((req) => svc.send(who(req).id, req.body.periodKey, req.body.note ?? null)));

// ── Team Variable Pay (managers: their team's status only, no approving) ──
router.get('/team', requireModule('hub_variable_pay_team'), wrap((req) => svc.team(who(req).id, who(req).role)));

// ── Variable Pay Overview (Finance Head / Admin): every appeal, by year or quarter (quarters can be combined) ──
const list = (v: unknown) => String(v ?? '').split(',').map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x > 0);
router.get('/finance', requireModule('hub_variable_pay_finance'), financeOnly, wrap((req) => svc.overview({
  years: list(req.query['years']), quarters: list(req.query['quarters']).filter((q) => q <= 4), groupBy: req.query['groupBy'] === 'year' ? 'year' : 'quarter',
})));
router.post('/finance/approve', requireModule('hub_variable_pay_finance'), financeOnly,
  validate(z.object({ items: z.array(z.object({ id: z.number().int().positive(), amount: money.nullish() })).min(1).max(500), comment: z.string().max(2000).nullish() })),
  wrap((req) => svc.financeApprove(who(req).id, who(req).role, req.body.items, req.body.comment ?? null)));
router.post('/finance/:id/return', requireModule('hub_variable_pay_finance'), financeOnly, validate(z.object({ comment: z.string().min(1).max(2000) })),
  wrap((req) => svc.financeReturn(who(req).id, who(req).role, Number(req.params['id']), req.body.comment)));
router.post('/finance/paid', requireModule('hub_variable_pay_finance'), financeOnly, validate(z.object({ ids: z.array(z.number().int().positive()).min(1).max(500), paidOn: ymd })),
  wrap((req) => svc.markPaid(who(req).id, req.body.ids, req.body.paidOn)));

// ── Policy & Slabs ──
router.get('/policy', requireModule('hub_variable_pay_policy'), wrap(async () => ({ slabs: await svc.slabs(), levels: { ASSOCIATE: 10, MANAGER: 20, HEAD_EL: 30 } })));
const SlabSchema = z.object({ from: z.number().min(0).max(1000), to: z.number().min(0).max(1000).nullable(), payout: z.number().min(0).max(1000).nullable(), cap: z.number().min(0).max(1000).optional() });
router.put('/policy', requireModule('hub_variable_pay_policy', 'update'), validate(z.object({ slabs: z.array(SlabSchema).min(1).max(8) })), wrap((req) => svc.saveSlabs(req.body.slabs)));

// ── Eligibility (HR / Admin) ──
router.get('/eligibility', requireModule('hub_variable_pay_eligibility'), wrap(() => svc.eligibility()));
router.put('/eligibility/:userId', requireModule('hub_variable_pay_eligibility', 'update'),
  validate(z.object({ annualVariable: money.nullish(), note: z.string().max(500).nullish(), cycle: z.enum(['QUARTERLY', 'HALF_YEARLY', 'ANNUAL']).nullish() })),
  wrap((req) => svc.setEligibility(who(req).id, Number(req.params['userId']), {
    ...(req.body.annualVariable !== undefined ? { annualVariable: req.body.annualVariable } : {}),
    note: req.body.note ?? null,
    ...(req.body.cycle !== undefined ? { cycle: req.body.cycle } : {}),
  })));

export default router;
