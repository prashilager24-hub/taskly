import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { AppError } from '../../utils/AppError';
import * as svc from './profile.service';

const router = Router();
router.use(authenticate);

// the signed-in person, or (for Access Management admins) someone else
function target(req: { user?: { sub?: string }; params: Record<string, string | undefined> }) {
  const me = Number(req.user?.sub);
  if (!me) throw AppError.unauthorized('Please sign in');
  const id = req.params['userId'] ? Number(req.params['userId']) : me;
  if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest('Invalid user');
  return { me, id };
}

// GET /profile/activity?days=90  and  /profile/:userId/activity?days=90
// (registered before /:userId, which would otherwise take "activity" as a user id)
router.get(['/activity', '/:userId/activity'], async (req, res, next) => {
  try {
    const { me, id } = target(req);
    await svc.assertCanView(me, id);
    res.json(await svc.getActivity(id, Number(req.query['days'] ?? 90)));
  } catch (e) { next(e); }
});

// GET /profile  and  /profile/:userId
router.get(['/', '/:userId'], async (req, res, next) => {
  try {
    const { me, id } = target(req);
    await svc.assertCanView(me, id);
    res.json(await svc.getProfile(id));
  } catch (e) { next(e); }
});

export default router;
