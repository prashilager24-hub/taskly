/**
 * HR routes — ports of:
 *   QueryController      → /t2.0/authentificationUtilization/hrFeedback/query
 *   EngagementController → /t2.0/authentificationUtilization/hrFeedback/engagement
 *   OnboardingController → /t2.0/authentificationUtilization/hrFeedback/onboarding
 *
 * All three routers are exported; app.ts mounts each at its sub-path.
 * The legacy survey/query helpers remain on hrRouter for backward-compat.
 */
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './hr.service';

// ── Query router  (/hrFeedback/query) ────────────────────────────────────────
const queryRouter = Router();
queryRouter.use(authenticate);

const RaiseQuerySchema = z.object({
  title: z.string().min(3),
  description: z.string().min(5),
  raised_by: z.number().int().positive(),
  category: z.string().optional(),
});

const ReplySchema = z.object({
  sender_id: z.number().int().positive(),
  message: z.string().min(1),
});

const ReassignSchema = z.object({
  assigned_to: z.number().int().positive(),
  reason: z.string().optional(),
});

const RateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

// GET  /query/mine
queryRouter.get('/mine', async (req, res, next) => {
  try {
    const { UserID } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getQueries({ UserID: UserID ? Number(UserID) : undefined }));
  } catch (e) { next(e); }
});

// POST /query/raise
queryRouter.post('/raise', validate(RaiseQuerySchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createQuery(req.body), 201); } catch (e) { next(e); }
});

// POST /query/:id/rate
queryRouter.post('/:id/rate', validate(RateSchema), async (req, res, next) => {
  try {
    sendSuccess(res, await svc.rateQuery(Number(req.params['id']), req.body));
  } catch (e) { next(e); }
});

// GET  /query/queue
queryRouter.get('/queue', async (req, res, next) => {
  try {
    const { status } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getQueries({ status }));
  } catch (e) { next(e); }
});

// POST /query/:id/reply
queryRouter.post('/:id/reply', validate(ReplySchema), async (req, res, next) => {
  try {
    sendSuccess(res, await svc.addQueryMessage({ query_id: Number(req.params['id']), ...req.body }), 201);
  } catch (e) { next(e); }
});

// POST /query/:id/resolve
queryRouter.post('/:id/resolve', async (req, res, next) => {
  try {
    sendSuccess(res, await svc.updateQueryStatus(Number(req.params['id']), 'RESOLVED'));
  } catch (e) { next(e); }
});

// POST /query/:id/reassign
queryRouter.post('/:id/reassign', validate(ReassignSchema), async (req, res, next) => {
  try {
    sendSuccess(res, await svc.reassignQuery(Number(req.params['id']), req.body));
  } catch (e) { next(e); }
});

// POST /query/:id/reopen
queryRouter.post('/:id/reopen', async (req, res, next) => {
  try {
    sendSuccess(res, await svc.updateQueryStatus(Number(req.params['id']), 'OPEN'));
  } catch (e) { next(e); }
});

// GET  /query/admin
queryRouter.get('/admin', async (req, res, next) => {
  try {
    const { status, UserID } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getQueries({ status, UserID: UserID ? Number(UserID) : undefined }));
  } catch (e) { next(e); }
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
  survey_id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  responses: z.record(z.unknown()),
});

const SendSurveySchema = z.object({
  survey_id: z.number().int().positive(),
  user_ids: z.array(z.number().int().positive()),
});

// GET  /onboarding/surveys/mine
onboardingRouter.get('/surveys/mine', async (req, res, next) => {
  try {
    const { UserID } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getOnboardingSurveys(Number(UserID)));
  } catch (e) { next(e); }
});

// POST /onboarding/submit  or  /onboarding/submit-survey
onboardingRouter.post(['/submit', '/submit-survey'], validate(OnboardingSubmitSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.submitSurveyResponse(req.body), 201); } catch (e) { next(e); }
});

// GET  /onboarding/surveys  or  /onboarding/surveys/list
onboardingRouter.get(['/surveys', '/surveys/list'], async (_req, res, next) => {
  try { sendSuccess(res, await svc.getSurveys()); } catch (e) { next(e); }
});

// GET  /onboarding/scores
onboardingRouter.get('/scores', async (req, res, next) => {
  try {
    const { survey_id } = req.query as Record<string, string>;
    sendSuccess(res, survey_id ? await svc.getSurveyResponses(Number(survey_id)) : []);
  } catch (e) { next(e); }
});

// POST /onboarding/send  or  /onboarding/send-survey
onboardingRouter.post(['/send', '/send-survey'], validate(SendSurveySchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.rolloutSurvey(req.body)); } catch (e) { next(e); }
});

// GET  /onboarding/admin
onboardingRouter.get('/admin', async (_req, res, next) => {
  try { sendSuccess(res, await svc.getSurveys()); } catch (e) { next(e); }
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
