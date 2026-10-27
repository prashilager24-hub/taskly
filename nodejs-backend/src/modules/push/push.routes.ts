import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import { env } from '../../config/env';
import * as svc from './push.service';

const router = Router();

const SubscribeSchema = z.object({
  user_id: z.number().int().positive(),
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

const NotifyUserSchema = z.object({
  user_id: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string().min(1),
  url: z.string().optional(),
  type: z.string().optional(),
});

const BroadcastSchema = z.object({
  user_ids: z.array(z.number().int().positive()).optional(),
  payload: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    url: z.string().optional(),
  }),
});

// Public: VAPID public key (needed by service worker before auth)
router.get('/vapid-public-key', (_req, res) => {
  sendSuccess(res, { publicKey: env.VAPID_PUBLIC_KEY });
});

// All other routes require auth
router.use(authenticate);

// Subscriptions
router.post('/subscribe', validate(SubscribeSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.saveSubscription(req.body)); } catch (e) { next(e); }
});
router.post('/unsubscribe', async (req, res, next) => {
  try { sendSuccess(res, await svc.removeSubscription(req.body.endpoint)); } catch (e) { next(e); }
});

// Send push to single user
router.post('/send', validate(NotifyUserSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createNotification(req.body)); } catch (e) { next(e); }
});

// Broadcast
router.post('/broadcast', validate(BroadcastSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.broadcastNotification(req.body)); } catch (e) { next(e); }
});

// In-app notification bell
router.get('/notifications/:userId', async (req, res, next) => {
  try {
    const unread = req.query['unread'] === 'true';
    sendSuccess(res, await svc.getUserNotifications(Number(req.params['userId']), unread));
  } catch (e) { next(e); }
});
router.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    sendSuccess(res, await svc.markRead(Number(req.params['id']), Number(req.body.user_id)));
  } catch (e) { next(e); }
});
router.post('/notifications/:userId/read-all', async (req, res, next) => {
  try { sendSuccess(res, await svc.markAllRead(Number(req.params['userId']))); } catch (e) { next(e); }
});

export default router;
