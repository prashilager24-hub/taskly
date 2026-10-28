import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requireModule } from '../../middlewares/permission';
import { validate } from '../../middlewares/validate';
import { authLimiter } from '../../middlewares/rateLimiter';
import { sendSuccess } from '../../utils/response';
import {
  LoginSchema,
  CreateUserSchema,
  UpdateUserSchema,
  UsersReadSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  UpdateUserStatusSchema,
  ArchiveUsersSchema,
  SwitchUserSchema,
  VerifyOtpSchema,
  ResendOtpSchema,
  ThemeSchema,
} from './auth.schema';
import * as ctrl from './auth.controller';
import * as svc from './auth.service';

const router = Router();

// ── Public routes ─────────────────────────────────────────────────────────────
router.post('/authenticate', authLimiter, validate(LoginSchema), ctrl.loginHandler);
router.post('/authenticate/verify-otp', authLimiter, validate(VerifyOtpSchema), ctrl.verifyOtpHandler);
router.post('/authenticate/resend-otp', authLimiter, validate(ResendOtpSchema), ctrl.resendOtpHandler);
router.post('/forgotPassword', authLimiter, validate(ForgotPasswordSchema), ctrl.forgotPasswordHandler);
router.post('/resetPassword', authLimiter, validate(ResetPasswordSchema), ctrl.resetPasswordHandler);

// ── Authenticated routes ───────────────────────────────────────────────────────
router.post('/users/read', authenticate, validate(UsersReadSchema), ctrl.getUsersHandler);
router.post('/updateUserStatus', authenticate, requireModule('accessmgmt', 'update'), validate(UpdateUserStatusSchema), ctrl.updateUserStatusHandler);
router.post('/usersArchive', authenticate, requireModule('accessmgmt', 'delete'), validate(ArchiveUsersSchema), ctrl.archiveUsersHandler);
router.post('/user/switch', authenticate, validate(SwitchUserSchema), ctrl.switchUserHandler);
router.post('/logout', authenticate, ctrl.logoutHandler);
router.put('/user/theme', authenticate, validate(ThemeSchema), ctrl.saveThemeHandler);

router.post('/User/create', authenticate, requireModule('accessmgmt', 'create'), validate(CreateUserSchema), ctrl.createUserHandler);
router.put('/User/update', authenticate, requireModule('accessmgmt', 'update'), validate(UpdateUserSchema), ctrl.updateUserHandler);

// GET /MissingData — returns users/departments missing required profile data
router.get('/MissingData', authenticate, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    res.json(await svc.getMissingData(startDate, endDate)); // raw array, as the Java endpoint returned
  } catch (e) { next(e); }
});

// POST /sendMailbulk — bulk email sender
router.post('/sendMailbulk', authenticate, async (req, res, next) => {
  try { sendSuccess(res, await svc.sendMailBulk(req.body)); } catch (e) { next(e); }
});

// ── AMRole — roles are managed in the access module (/access/roles); this stays for old callers
// GET  /AMRole/:roleId
router.get('/AMRole/:roleId', authenticate, ctrl.getRoleHandler);

export default router;
