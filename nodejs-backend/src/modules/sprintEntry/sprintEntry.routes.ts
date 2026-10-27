/**
 * Sprint Entry routes — SprintEntryController port
 * Base: /t2.0/authentificationUtilization (mounted directly on BASE)
 */
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './sprintEntry.service';

const router = Router();
router.use(authenticate);

const SprintSubmitSchema = z.object({
  UserID: z.number().int().positive(),
  SprintID: z.number().int().positive(),
  WorkDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  PointsCompleted: z.number().min(0),
  StoryID: z.number().int().positive().optional(),
  Notes: z.string().optional(),
});

// POST /createSprintEntry
router.post('/createSprintEntry', validate(SprintSubmitSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createSprintEntry(req.body), 201); } catch (e) { next(e); }
});

// PUT /updateSprint/:id
router.put('/updateSprint/:id', validate(SprintSubmitSchema), async (req, res, next) => {
  try {
    sendSuccess(res, await svc.updateSprintEntry(Number(req.params['id']), req.body));
  } catch (e) { next(e); }
});

// GET /getSprintEntry?userId=&sprint=&from=&to=&page=&size=
router.get('/getSprintEntry', async (req, res, next) => {
  try {
    const { userId, sprint, from, to, page = '0', size = '20' } = req.query as Record<string, string>;
    sendSuccess(res, await svc.findHistory(Number(userId), sprint, from, to, Number(page), Number(size)));
  } catch (e) { next(e); }
});

// GET /labels
router.get('/labels', async (_req, res, next) => {
  try { sendSuccess(res, await svc.getAllSprintLabels()); } catch (e) { next(e); }
});

// Note: GET /:id and DELETE /:id and PATCH /:id/manager-note overlap with other routes.
// These are mounted at /t2.0/authentificationUtilization directly — use specific prefixed paths.
// SprintEntryController used generic /{id} which conflicts; we add them with distinct prefix:
router.get('/sprintEntry/:id', async (req, res, next) => {
  try { sendSuccess(res, await svc.findById(Number(req.params['id']))); } catch (e) { next(e); }
});

router.delete('/sprintEntry/:id', async (req, res, next) => {
  try { sendSuccess(res, await svc.deleteEntry(Number(req.params['id']))); } catch (e) { next(e); }
});

router.patch('/sprintEntry/:id/manager-note', async (req, res, next) => {
  try {
    sendSuccess(res, await svc.patchManagerNote(Number(req.params['id']), req.body.managerNote));
  } catch (e) { next(e); }
});

export default router;
