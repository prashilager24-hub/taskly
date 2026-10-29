/** /t2.0/authentificationUtilization/appraisal — yearly appraisal. Who may do what is decided per cycle in the service, not by role alone. */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { requireModule } from '../../middlewares/permission';
import { validate } from '../../middlewares/validate';
import { sendSuccess } from '../../utils/response';
import { MAX_AMOUNT } from './appraisal.calc';
import * as svc from './appraisal.service';

const router = Router();
router.use(authenticate, requireModule('appraisal', 'read'));

const me = (req: Request) => Number(req.user?.sub);
const roleOf = (req: Request) => Number(req.user?.role);
const handler = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };
const cycleId = (req: Request) => Number(req.params['cycleId']);

// ── Schemas ───────────────────────────────────────────────────────────────────────────────────────

const amount = z.number().min(0).max(MAX_AMOUNT);
const text = z.string().max(4000);
const rating = z.number().min(1).max(5).multipleOf(0.1);
const quarterNo = z.number().int().min(1).max(4);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const ANSWER_KEYS = ['goalsAchieved', 'goalsNotAchievedWhy', 'howRatingAchieved', 'difficultiesAndWhy', 'howUpdatingGoalsTargets', 'whoApprovesGoalsTargets', 'whyDeserveSalary', 'whyExpectThisSalary', 'biggestMilestone', 'biggestAchievement'] as const;
const answers = z.object(Object.fromEntries(ANSWER_KEYS.map((k) => [k, text.optional()])) as Record<(typeof ANSWER_KEYS)[number], z.ZodOptional<z.ZodString>>).strict();

const SelfReview = z.object({
  answers,
  quarters: z.array(z.object({ quarter: quarterNo, goals: text.optional(), targets: text.optional(), biggestAchievements: text.optional(), biggestFailures: text.optional() })).max(4),
  expectedHike: amount.nullable().optional(),
  targetHike: amount.nullable().optional(),
  request: z.object({ newDesignation: z.string().max(150).optional(), designationComment: text.optional(), newTeam: z.string().max(150).optional(), teamComment: text.optional() }).optional(),
  submit: z.boolean(),
});

const AssessorReview = z.object({
  quarters: z.array(z.object({ quarter: quarterNo, finalRating: rating.nullable().optional(), comments: text.optional() })).max(4),
  overallRating: rating.nullable().optional(),
  comment: text.optional(),
  managerFeedback: text.optional(),
  minimalHike: amount.nullable().optional(),
  submit: z.boolean(),
});

const Budget = z.object({ approvedHike: amount, comment: text.optional() });

const Respond = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('ACCEPT'), comment: text.optional() }),
  z.object({ decision: z.literal('REJECT'), postponeMonths: z.union([z.literal(3), z.literal(6)]), reason: z.string().trim().min(1, 'Give a reason').max(4000), expectations: z.string().trim().min(1, 'Say what you expect').max(4000), comment: text.optional() }),
]);

const HrDecision = z.object({ status: z.enum(['APPROVED', 'RETURNED']), comment: text.optional() });
const NewCycle = z.object({ userId: z.number().int().positive(), cycleStartDate: date });
const Person = z.object({ dateOfJoining: date.nullable(), level: z.enum(['ASSOCIATE', 'MANAGER', 'HEAD_EL']).nullable(), currentAnnualCtc: amount.nullable() });
const TeamQuery = z.object({ status: z.enum(['EMPLOYEE_OPEN', 'ASSESSOR_OPEN', 'FINANCE_REVIEW', 'OFFERED', 'ACCEPTED', 'POSTPONED']).optional() });

// ── Routes ────────────────────────────────────────────────────────────────────────────────────────

router.get('/availability', handler(async (req, res) => { sendSuccess(res, await svc.availability(me(req), roleOf(req))); }));
router.get('/my', handler(async (req, res) => { sendSuccess(res, await svc.myCycle(me(req), roleOf(req))); }));
router.get('/team', validate(TeamQuery, 'query'), handler(async (req, res) => { sendSuccess(res, await svc.team(me(req), roleOf(req), (req.query as { status?: string }).status)); }));
router.get('/hr', handler(async (req, res) => {
  if (!svc.isHr(roleOf(req))) { res.status(403).json({ success: false, message: 'Insufficient permissions' }); return; }
  sendSuccess(res, await svc.hrList());
}));
router.get('/people', handler(async (req, res) => { sendSuccess(res, await svc.people(roleOf(req))); }));
router.put('/people/:userId', validate(Person), handler(async (req, res) => { await svc.updatePerson(roleOf(req), Number(req.params['userId']), req.body); sendSuccess(res, true); }));
router.get('/cycles/:cycleId', handler(async (req, res) => { sendSuccess(res, await svc.cycleFor(cycleId(req), me(req), roleOf(req))); }));

router.put('/cycles/:cycleId/self-review', validate(SelfReview), handler(async (req, res) => { await svc.saveSelfReview(cycleId(req), me(req), req.body); sendSuccess(res, true); }));
router.put('/cycles/:cycleId/assessor-review', validate(AssessorReview), handler(async (req, res) => { await svc.saveAssessorReview(cycleId(req), me(req), req.body); sendSuccess(res, true); }));
router.put('/cycles/:cycleId/budget-approval', validate(Budget), handler(async (req, res) => { await svc.approveBudget(cycleId(req), me(req), roleOf(req), req.body); sendSuccess(res, true); }));
router.post('/cycles/:cycleId/respond', validate(Respond), handler(async (req, res) => { sendSuccess(res, await svc.respond(cycleId(req), me(req), req.body)); }));
router.put('/cycles/:cycleId/hr-decision', validate(HrDecision), handler(async (req, res) => { await svc.hrDecision(cycleId(req), me(req), roleOf(req), req.body); sendSuccess(res, true); }));
router.post('/cycles', validate(NewCycle), handler(async (req, res) => { sendSuccess(res, await svc.createCycle(me(req), roleOf(req), req.body), 201); }));

export default router;
