import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './sprints.service';

const router = Router();
router.use(authenticate);

const CreateSprintSchema = z.object({
  SprintName: z.string().min(2),
  ProjectID: z.string().min(2),
  StartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  EndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  PlannedPoints: z.number().int().positive(),
});

const CreateStorySchema = z.object({
  SprintID: z.number().int().positive(),
  StoryKey: z.string().min(2),
  StoryPoints: z.number().int().min(1),
});

const AssignStorySchema = z.object({
  StoryID: z.number().int().positive(),
  UserID: z.number().int().positive(),
  PointsWorked: z.number().min(0),
});

router.get('/', async (req, res, next) => {
  try {
    const { Status, ProjectID } = req.query as Record<string, string>;
    sendSuccess(res, await svc.getSprints({ Status, ProjectID }));
  } catch (e) { next(e); }
});
router.get('/:id', async (req, res, next) => {
  try { sendSuccess(res, await svc.getSprintById(Number(req.params['id']))); } catch (e) { next(e); }
});
router.post('/', validate(CreateSprintSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createSprint(req.body), 201); } catch (e) { next(e); }
});
router.patch('/:id/status', async (req, res, next) => {
  try { sendSuccess(res, await svc.updateSprintStatus(Number(req.params['id']), req.body.status)); } catch (e) { next(e); }
});
router.get('/:id/stories', async (req, res, next) => {
  try { sendSuccess(res, await svc.getSprintStories(Number(req.params['id']))); } catch (e) { next(e); }
});
router.post('/stories', validate(CreateStorySchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createStory(req.body), 201); } catch (e) { next(e); }
});
router.patch('/stories/:id/status', async (req, res, next) => {
  try { sendSuccess(res, await svc.updateStoryStatus(Number(req.params['id']), req.body.status)); } catch (e) { next(e); }
});
router.post('/stories/assign', validate(AssignStorySchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.assignStory(req.body), 201); } catch (e) { next(e); }
});
router.get('/:id/team', async (req, res, next) => {
  try { sendSuccess(res, await svc.getSprintTeam(Number(req.params['id']))); } catch (e) { next(e); }
});
router.post('/:id/team', async (req, res, next) => {
  try { sendSuccess(res, await svc.addSprintMember(Number(req.params['id']), req.body.UserID)); } catch (e) { next(e); }
});
router.get('/:id/entries', async (req, res, next) => {
  try { sendSuccess(res, await svc.getSprintEntries(Number(req.params['id']))); } catch (e) { next(e); }
});

export default router;
