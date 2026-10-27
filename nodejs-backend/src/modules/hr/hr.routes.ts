import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './hr.service';

const router = Router();
router.use(authenticate);

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

// Queries
router.get('/queries', async (req, res, next) => {
  try {
    const { status, UserID } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getQueries({ status, UserID: UserID ? Number(UserID) : undefined }));
  } catch (e) { next(e); }
});
router.post('/queries', validate(CreateQuerySchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createQuery(req.body), 201); } catch (e) { next(e); }
});
router.get('/queries/:id/messages', async (req, res, next) => {
  try { sendSuccess(res, await svc.getQueryMessages(Number(req.params['id']))); } catch (e) { next(e); }
});
router.post('/queries/messages', validate(AddMessageSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.addQueryMessage(req.body), 201); } catch (e) { next(e); }
});
router.patch('/queries/:id/status', async (req, res, next) => {
  try { sendSuccess(res, await svc.updateQueryStatus(Number(req.params['id']), req.body.status)); } catch (e) { next(e); }
});

// Surveys
router.get('/surveys', async (_req, res, next) => {
  try { sendSuccess(res, await svc.getSurveys()); } catch (e) { next(e); }
});
router.get('/surveys/:id/responses', async (req, res, next) => {
  try { sendSuccess(res, await svc.getSurveyResponses(Number(req.params['id']))); } catch (e) { next(e); }
});
router.post('/surveys/respond', validate(SurveyResponseSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.submitSurveyResponse(req.body), 201); } catch (e) { next(e); }
});
router.get('/onboarding/:userId', async (req, res, next) => {
  try { sendSuccess(res, await svc.getOnboardingSurveys(Number(req.params['userId']))); } catch (e) { next(e); }
});

export default router;
