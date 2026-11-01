/** /t2.0/authentificationUtilization/appraisal — yearly appraisal. Who may do what is decided per cycle in the service, not by role alone. */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { requireModule } from '../../middlewares/permission';
import { validate } from '../../middlewares/validate';
import { sendSuccess } from '../../utils/response';
import { MAX_AMOUNT } from './appraisal.calc';
import * as svc from './appraisal.service';
import * as flow from './appraisal.flow';
import { periodOf, todayIST } from './appraisal.calc';
import { pool } from '../../config/db';
import { AppError } from '../../utils/AppError';

const router = Router();
router.use(authenticate, requireModule('appraisal', 'read'));
// The Finance Head acts as Finance in this module, and anyone in the HR department acts as HR, whatever their role is
// elsewhere (an Admin stays an Admin)
router.use((req, _res, next) => {
  if (Number(req.user?.role) === 1) return next();
  const uid = Number(req.user?.sub);
  (async () => {
    const r = req as Request & { appraisalRole?: number };
    if (await svc.isFinanceHead(uid)) r.appraisalRole = svc.FINANCE_HEAD_ROLE;
    else if (await svc.inHrDepartment(uid)) r.appraisalRole = svc.HR_MEMBER_ROLE;
  })().then(() => next()).catch(next);
});

const me = (req: Request) => Number(req.user?.sub);
const roleOf = (req: Request) => (req as Request & { appraisalRole?: number }).appraisalRole ?? Number(req.user?.role);
const handler = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };
const cycleId = (req: Request) => Number(req.params['cycleId']);

// ── Schemas ───────────────────────────────────────────────────────────────────────────────────────

const amount = z.number().min(0).max(MAX_AMOUNT);
const text = z.string().max(4000);
const quarterNo = z.number().int().min(1).max(4);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const ANSWER_KEYS = ['goalsAchieved', 'goalsNotAchievedWhy', 'howRatingAchieved', 'difficultiesAndWhy', 'howUpdatingGoalsTargets', 'whoApprovesGoalsTargets', 'whyDeserveSalary', 'whyExpectThisSalary', 'biggestMilestone', 'biggestAchievement'] as const;
const answers = z.object(Object.fromEntries(ANSWER_KEYS.map((k) => [k, text.optional()])) as Record<(typeof ANSWER_KEYS)[number], z.ZodOptional<z.ZodString>>).strict();

const variableOverride = z.object({ mode: z.enum(['PCT', 'AMOUNT']), value: amount });

const SelfReview = z.object({
  // Part B (written answers) is no longer asked; still accepted from older clients
  answers: answers.optional().default({}),
  // Part A: the PMS numbers are read-only; per quarter the employee writes comments, biggest achievements and biggest failures
  quarters: z.array(z.object({ quarter: quarterNo, goals: text.optional(), targets: text.optional(), comments: text.optional(), biggestAchievements: text.optional(), biggestFailures: text.optional() })).max(4).optional(),
  expectedHike: amount.nullable().optional(),
  targetHike: amount.nullable().optional(),
  expectedVariable: variableOverride.nullable().optional(),
  targetVariable: variableOverride.nullable().optional(),
  request: z.object({ newDesignation: z.string().max(150).optional(), designationComment: text.optional(), newTeam: z.string().max(150).optional(), teamComment: text.optional() }).optional(),
  submit: z.boolean(),
});

const Respond = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('ACCEPT'), comment: text.optional(), request: z.object({ newDesignation: z.string().max(150).optional(), designationComment: text.optional(), newTeam: z.string().max(150).optional(), teamComment: text.optional() }).optional() }),
  z.object({ decision: z.literal('REJECT'), postponeMonths: z.union([z.literal(3), z.literal(6)]), reason: z.string().trim().min(1, 'Give a reason').max(4000), expectations: z.string().trim().min(1, 'Say what you expect').max(4000), comment: text.optional() }),
]);

const finalDecision = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), comment: text.optional() });
const RequestDecision = z.object({ designation: finalDecision.optional(), team: finalDecision.optional() });
const HrDecision = z.object({ status: z.enum(['APPROVED', 'RETURNED']), comment: text.optional() });
const Person = z.object({ dateOfJoining: date.nullable(), level: z.enum(['ASSOCIATE', 'MANAGER', 'HEAD_EL']).nullable(), currentAnnualCtc: amount.nullable() });
const Period = z.object({ period: date.optional() });
const BudgetBody = z.object({ amount, comment: z.string().trim().min(1, 'Write why this budget is given').max(4000) });
const BudgetResponse = z.object({ accept: z.boolean(), comment: text.optional(), amount: amount.nullable().optional() });
const SplitBody = z.object({
  own: z.object({ amount, comment: text.optional() }).nullable().optional(),
  direct: z.array(z.object({ cycleId: z.number().int().positive(), amount, reason: text.optional() })).max(500).optional(),
  shares: z.array(z.object({ flUserId: z.number().int().positive(), amount, comment: text.optional() })).max(200).optional(),
  send: z.boolean(),
});
const AllocationBody = z.object({
  items: z.array(z.object({ cycleId: z.number().int().positive(), amount: amount.nullable(), reason: text.optional() })).max(500),
  justification: text.optional(),
  submit: z.boolean(),
});
const DirectBody = z.object({ amount, reason: text.optional() });
const Forward = z.object({ comment: text.optional(), recommend: z.boolean() });
const People = z.object({ rows: z.array(Person.extend({ userId: z.number().int().positive() })).min(1).max(5000) });

// ── Routes ────────────────────────────────────────────────────────────────────────────────────────

// Department, A1 / A2, level and CTC edits reach the appraisals nobody has decided yet before anyone reads or acts on them
const SYNCED = ['/availability', '/departments', '/departments/:departmentId/:period', '/departments/:departmentId/:period/budget', '/split', '/split/:departmentId/:period', '/split/:departmentId/:period/budget-response',
  '/allocation', '/allocation/:departmentId/:period', '/requests', '/cycles/:cycleId'];
router.all(SYNCED, (req, _res, next) => { svc.syncOpenCycles(req.method !== 'GET').then(() => next(), next); });

router.get('/finance-head', handler(async (_req, res) => { sendSuccess(res, await svc.financeHead()); }));
router.put('/finance-head', validate(z.object({ userId: z.number().int().positive() })), handler(async (req, res) => { sendSuccess(res, await svc.setFinanceHead(roleOf(req), req.body.userId)); }));
router.get('/availability', handler(async (req, res) => { sendSuccess(res, await svc.availability(me(req), roleOf(req))); }));
router.get('/my', handler(async (req, res) => { sendSuccess(res, await svc.myCycle(me(req), roleOf(req))); }));
router.get('/hr', handler(async (req, res) => {
  if (!svc.isHr(roleOf(req))) { res.status(403).json({ success: false, message: 'Insufficient permissions' }); return; }
  sendSuccess(res, await svc.hrList());
}));
router.get('/people', handler(async (req, res) => { sendSuccess(res, await svc.people(roleOf(req))); }));
// HR: saving the details is all it takes; the appraisal starts on its own when the person's April / October cycle is due
router.post('/people/bulk', validate(People), handler(async (req, res) => { sendSuccess(res, await svc.bulkUpdatePeople(me(req), roleOf(req), req.body.rows)); }));
router.put('/people/:userId', validate(Person), handler(async (req, res) => { sendSuccess(res, await svc.updatePerson(me(req), roleOf(req), Number(req.params['userId']), req.body)); }));
router.get('/cycles/:cycleId', handler(async (req, res) => { sendSuccess(res, await svc.cycleFor(cycleId(req), me(req), roleOf(req))); }));

router.put('/cycles/:cycleId/self-review', validate(SelfReview), handler(async (req, res) => { await svc.saveSelfReview(cycleId(req), me(req), req.body); sendSuccess(res, true); }));

// Finance Head: every department of a period, one department's appeals, its budget with a reason
const fin = (req: Request) => { if (!svc.isFinance(roleOf(req))) throw AppError.forbidden('Only the Finance Head can see this'); };
const deptPeriod = (req: Request) => ({ departmentId: Number(req.params['departmentId']), period: String(req.params['period']) });
router.get('/periods', handler(async (_req, res) => { sendSuccess(res, await flow.periods()); }));
router.get('/departments', validate(Period, 'query'), handler(async (req, res) => { fin(req); sendSuccess(res, await flow.board((req.query as { period?: string }).period ?? periodOf(todayIST()))); }));
router.get('/departments/:departmentId/:period', handler(async (req, res) => {
  const { departmentId, period } = deptPeriod(req);
  if (!svc.isFinance(roleOf(req)) && !(await flow.isElOf(me(req), departmentId))) throw AppError.forbidden('Only the Finance Head or this department\'s EL can see this');
  sendSuccess(res, await flow.loadRound(pool, departmentId, period));
}));
router.put('/departments/:departmentId/:period/budget', validate(BudgetBody), handler(async (req, res) => { fin(req); const { departmentId, period } = deptPeriod(req); await flow.setBudget(me(req), departmentId, period, req.body.amount, req.body.comment); sendSuccess(res, true); }));

// EL: the budget from the Finance Head, the split, the FL proposals to approve
router.get('/split', handler(async (req, res) => { sendSuccess(res, await flow.elRounds(me(req))); }));
router.put('/split/:departmentId/:period', validate(SplitBody), handler(async (req, res) => { const { departmentId, period } = deptPeriod(req); await flow.saveSplit(me(req), roleOf(req), departmentId, period, req.body); sendSuccess(res, true); }));
router.put('/split/:departmentId/:period/budget-response', validate(BudgetResponse), handler(async (req, res) => { const { departmentId, period } = deptPeriod(req); await flow.respondBudget(me(req), roleOf(req), departmentId, period, req.body); sendSuccess(res, true); }));
router.put('/split/:departmentId/:period/shares/:flUserId/approve', handler(async (req, res) => { const { departmentId, period } = deptPeriod(req); await flow.approveShare(me(req), roleOf(req), departmentId, period, Number(req.params['flUserId'])); sendSuccess(res, true); }));
router.put('/split/:departmentId/:period/direct/:cycleId', validate(DirectBody), handler(async (req, res) => { const { departmentId, period } = deptPeriod(req); await flow.offerDirect(me(req), roleOf(req), departmentId, period, Number(req.params['cycleId']), req.body.amount, req.body.reason ?? ''); sendSuccess(res, true); }));

// FL: the share from the EL, turned into hikes for the team and their own
router.get('/allocation', handler(async (req, res) => { sendSuccess(res, { shares: await flow.flShares(me(req)), waiting: await flow.flWaiting(me(req)) }); }));
router.put('/allocation/:departmentId/:period', validate(AllocationBody), handler(async (req, res) => { const { departmentId, period } = deptPeriod(req); await flow.saveAllocation(me(req), departmentId, period, req.body); sendSuccess(res, true); }));

// Designation / team requests: the FL forwards an Associate's / Intern's, the EL decides
router.get('/requests', handler(async (req, res) => { sendSuccess(res, await svc.requestsInbox(me(req), roleOf(req))); }));
router.put('/cycles/:cycleId/request-forward', validate(Forward), handler(async (req, res) => { await svc.forwardRequests(cycleId(req), me(req), roleOf(req), req.body); sendSuccess(res, true); }));
router.post('/cycles/:cycleId/respond', validate(Respond), handler(async (req, res) => { sendSuccess(res, await svc.respond(cycleId(req), me(req), req.body)); }));
router.put('/cycles/:cycleId/request-decision', validate(RequestDecision), handler(async (req, res) => { await svc.decideRequests(cycleId(req), me(req), roleOf(req), req.body); sendSuccess(res, true); }));
router.put('/cycles/:cycleId/hr-decision', validate(HrDecision), handler(async (req, res) => { await svc.hrDecision(cycleId(req), me(req), roleOf(req), req.body); sendSuccess(res, true); }));

export default router;
