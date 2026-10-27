/**
 * Tech Sprint routes — TechSprintController port
 * Base: /t2.0/authentificationUtilization/tech
 */
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import * as svc from './tech.service';

const router = Router();
router.use(authenticate);

const CreateSprintSchema = z.object({
  SprintName: z.string().min(2),
  ProjectID: z.string().optional(),
  StartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  EndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  PlannedPoints: z.number().int().positive().optional(),
});

const CreateStorySchema = z.object({
  SprintID: z.number().int().positive(),
  StoryKey: z.string().min(2),
  Title: z.string().optional(),
  StoryPoints: z.number().int().min(1),
  AssignedTo: z.number().int().positive().optional(),
});

// POST /tech/sprint
router.post('/sprint', validate(CreateSprintSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createTechSprint(req.body), 201); } catch (e) { next(e); }
});

// POST /tech/sprint/:sprintId/users
router.post('/sprint/:sprintId/users', async (req, res, next) => {
  try {
    sendSuccess(res, await svc.addSprintUsers(Number(req.params['sprintId']), req.body.userIDs));
  } catch (e) { next(e); }
});

// POST /tech/story
router.post('/story', validate(CreateStorySchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createStory(req.body), 201); } catch (e) { next(e); }
});

// POST /tech/story/:storyId/assign/:userId
router.post('/story/:storyId/assign/:userId', async (req, res, next) => {
  try {
    sendSuccess(res, await svc.assignStory(
      Number(req.params['storyId']),
      Number(req.params['userId']),
      req.body.PointsWorked ?? 0,
    ));
  } catch (e) { next(e); }
});

// PUT /tech/story/:storyId/status
router.put('/story/:storyId/status', async (req, res, next) => {
  try {
    sendSuccess(res, await svc.updateStoryStatus(Number(req.params['storyId']), req.body.status));
  } catch (e) { next(e); }
});

// POST /tech/list
router.post('/list', async (req, res, next) => {
  try { sendSuccess(res, await svc.listTechSprints(req.body)); } catch (e) { next(e); }
});

// POST /tech/stories
router.post('/stories', async (req, res, next) => {
  try { sendSuccess(res, await svc.listStories(req.body)); } catch (e) { next(e); }
});

export default router;
