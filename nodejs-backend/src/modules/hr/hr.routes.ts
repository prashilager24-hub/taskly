/**
 * HR routes — ports of:
 *   QueryController      → /t2.0/authentificationUtilization/hrFeedback/query
 *   EngagementController → /t2.0/authentificationUtilization/hrFeedback/engagement
 *   OnboardingController → /t2.0/authentificationUtilization/hrFeedback/onboarding
 *
 * All three routers are exported; app.ts mounts each at its sub-path.
 * The legacy survey/query helpers remain on hrRouter for backward-compat.
 */
import { Router, type Request, type Response } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './hr.service';
import * as qs from './query.service';
import * as ob from './onboarding.service';

// ── Query router  (/hrFeedback/query) — port of Java QueryController ─────────
// Responses use Java's ApiResponse { success, message, data, timestamp }; the HR frontend reads `data`.
const queryRouter = Router();
queryRouter.use(authenticate);

const apiOk = (res: Response, data: unknown, message?: string, status = 200) =>
  res.status(status).json({ success: true, ...(message ? { message } : {}), data, timestamp: new Date().toISOString() });
const who = (req: Request) => ({ id: Number(req.user!.sub), name: req.user!.username });

const RaiseQuerySchema = z.object({
  team: z.string().min(1),
  category: z.string().min(1),
  subject: z.string().trim().min(1, 'Subject is required').max(200),
  description: z.string().trim().min(1, 'Description is required'),
  priority: z.string().optional(),
});
const RateSchema = z.object({
  ratings: z.array(z.number().int().min(1).max(10)).min(1),
  comment: z.string().nullish(),
});
const ReplySchema = z.object({ text: z.string().trim().min(1, 'Reply text is required') });

queryRouter.get('/mine', async (req, res, next) => {
  try { apiOk(res, await qs.getMine(who(req).id)); } catch (e) { next(e); }
});
queryRouter.post('/raise', validate(RaiseQuerySchema), async (req, res, next) => {
  try { apiOk(res, await qs.raiseQuery(who(req), req.body), 'Query raised successfully', 201); } catch (e) { next(e); }
});
queryRouter.post('/:id/rate', validate(RateSchema), async (req, res, next) => {
  try { apiOk(res, await qs.rateQuery(String(req.params['id']), who(req).id, req.body), 'Query rated successfully'); } catch (e) { next(e); }
});
queryRouter.get('/queue', async (req, res, next) => {
  try { apiOk(res, await qs.getQueue(qs.parseTeam(req.query['team'] ?? 'HR'))); } catch (e) { next(e); }
});
queryRouter.post('/:id/reply', validate(ReplySchema), async (req, res, next) => {
  try { apiOk(res, await qs.reply(String(req.params['id']), who(req).name, req.body.text), 'Reply sent successfully'); } catch (e) { next(e); }
});
queryRouter.post('/:id/resolve', async (req, res, next) => {
  try { apiOk(res, await qs.resolve(String(req.params['id'])), 'Query resolved successfully'); } catch (e) { next(e); }
});
queryRouter.post('/:id/reassign', async (req, res, next) => {
  try { apiOk(res, await qs.reassign(String(req.params['id'])), 'Query reassigned successfully'); } catch (e) { next(e); }
});
queryRouter.post('/:id/reopen', async (req, res, next) => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : null;
    apiOk(res, await qs.reopen(String(req.params['id']), who(req).id, reason), 'Query reopened successfully');
  } catch (e) { next(e); }
});
queryRouter.get('/admin', async (_req, res, next) => {
  try { apiOk(res, await qs.getAdmin()); } catch (e) { next(e); }
});

// ── Engagement router  (/hrFeedback/engagement) ──────────────────────────────
const engagementRouter = Router();
engagementRouter.use(authenticate);

const EngagementSubmitSchema = z.object({
  survey_id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  responses: z.record(z.unknown()),
});

const RolloutSchema = z.object({
  survey_id: z.number().int().positive(),
  department_ids: z.array(z.number().int().positive()).optional(),
  user_ids: z.array(z.number().int().positive()).optional(),
});

// GET  /engagement/surveys/open
engagementRouter.get('/surveys/open', async (_req, res, next) => {
  try { sendSuccess(res, await svc.getSurveys()); } catch (e) { next(e); }
});

// POST /engagement/submit
engagementRouter.post('/submit', validate(EngagementSubmitSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.submitSurveyResponse(req.body), 201); } catch (e) { next(e); }
});

// GET  /engagement/surveys  or  /engagement/surveys/list
engagementRouter.get(['/surveys', '/surveys/list'], async (_req, res, next) => {
  try { sendSuccess(res, await svc.getSurveys()); } catch (e) { next(e); }
});

// GET  /engagement/scores/:surveyId
engagementRouter.get('/scores/:surveyId', async (req, res, next) => {
  try {
    sendSuccess(res, await svc.getSurveyResponses(Number(req.params['surveyId'])));
  } catch (e) { next(e); }
});

// POST /engagement/rollout
engagementRouter.post('/rollout', validate(RolloutSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.rolloutSurvey(req.body)); } catch (e) { next(e); }
});

// GET  /engagement/admin
engagementRouter.get('/admin', async (_req, res, next) => {
  try { sendSuccess(res, await svc.getSurveys()); } catch (e) { next(e); }
});

// ── Onboarding router  (/hrFeedback/onboarding) ──────────────────────────────
const onboardingRouter = Router();
onboardingRouter.use(authenticate);

const OnboardingSubmitSchema = z.object({
  surveyId: z.string().trim().min(1, 'Survey ID is required'),
  answers: z.array(z.number().int().min(1).max(10)).length(7, 'Exactly 7 answers required'),
  feedback: z.string().nullish(),
});

const OnboardingSendSchema = z.object({
  recipients: z.array(z.string().min(1)).min(1, 'Recipients list cannot be empty'),
  dueDate: z.string().trim().min(1, 'Due date is required'),
  notifyList: z.string().nullish(),
  departmentOverrides: z.record(z.string()).nullish(),
});

onboardingRouter.get('/surveys/mine', async (req, res, next) => {
  try { apiOk(res, await ob.getMine(who(req).id)); } catch (e) { next(e); }
});
onboardingRouter.post(['/submit', '/submit-survey'], validate(OnboardingSubmitSchema), async (req, res, next) => {
  try { apiOk(res, await ob.submitSurvey(who(req).id, req.body), 'Survey submitted successfully'); } catch (e) { next(e); }
});
onboardingRouter.get(['/surveys', '/surveys/list'], async (req, res, next) => {
  try {
    const { status, dateRange } = req.query as Record<string, string | undefined>;
    apiOk(res, await ob.getSurveysHR(status ?? 'all', dateRange));
  } catch (e) { next(e); }
});
onboardingRouter.get('/scores', async (_req, res, next) => {
  try { apiOk(res, await ob.getScores()); } catch (e) { next(e); }
});
onboardingRouter.post(['/send', '/send-survey'], validate(OnboardingSendSchema), async (req, res, next) => {
  try { apiOk(res, await ob.sendSurvey(req.body), 'Surveys sent successfully', 201); } catch (e) { next(e); }
});
onboardingRouter.get('/admin', async (_req, res, next) => {
  try { apiOk(res, await ob.getAdmin()); } catch (e) { next(e); }
});

// ── Legacy hrRouter (backward-compat, kept at /hrFeedback) ──────────────────
const hrRouter = Router();
hrRouter.use(authenticate);

const CreateQuerySchema = z.object({
  title: z.string().min(3),
  description: z.string().min(5),
  raised_by: z.number().int().positive(),
  category: z.string().optional(),
});

const AddMessageSchema = z.object({
  query_id: z.number().int().positive(),
  sender_id: z.number().int().positive(),
  message: z.string().min(1),
});

const SurveyResponseSchema = z.object({
  survey_id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  responses: z.record(z.unknown()),
});

hrRouter.get('/queries', async (req, res, next) => {
  try {
    const { status, UserID } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getQueries({ status, UserID: UserID ? Number(UserID) : undefined }));
  } catch (e) { next(e); }
});
hrRouter.post('/queries', validate(CreateQuerySchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createQuery(req.body), 201); } catch (e) { next(e); }
});
hrRouter.get('/queries/:id/messages', async (req, res, next) => {
  try { sendSuccess(res, await svc.getQueryMessages(Number(req.params['id']))); } catch (e) { next(e); }
});
hrRouter.post('/queries/messages', validate(AddMessageSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.addQueryMessage(req.body), 201); } catch (e) { next(e); }
});
hrRouter.patch('/queries/:id/status', async (req, res, next) => {
  try { sendSuccess(res, await svc.updateQueryStatus(Number(req.params['id']), req.body.status)); } catch (e) { next(e); }
});
hrRouter.get('/surveys', async (_req, res, next) => {
  try { sendSuccess(res, await svc.getSurveys()); } catch (e) { next(e); }
});
hrRouter.get('/surveys/:id/responses', async (req, res, next) => {
  try { sendSuccess(res, await svc.getSurveyResponses(Number(req.params['id']))); } catch (e) { next(e); }
});
hrRouter.post('/surveys/respond', validate(SurveyResponseSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.submitSurveyResponse(req.body), 201); } catch (e) { next(e); }
});
hrRouter.get('/onboarding/:userId', async (req, res, next) => {
  try { sendSuccess(res, await svc.getOnboardingSurveys(Number(req.params['userId']))); } catch (e) { next(e); }
});

export { queryRouter, engagementRouter, onboardingRouter };
export default hrRouter;
