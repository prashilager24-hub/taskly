import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { authLimiter } from '../../middlewares/rateLimiter';
import { z } from 'zod';
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
router.post('/updateUserStatus', authenticate, validate(UpdateUserStatusSchema), ctrl.updateUserStatusHandler);
router.post('/usersArchive', authenticate, validate(ArchiveUsersSchema), ctrl.archiveUsersHandler);
router.post('/user/switch', authenticate, validate(SwitchUserSchema), ctrl.switchUserHandler);
router.post('/logout', authenticate, ctrl.logoutHandler);
router.put('/user/theme', authenticate, validate(ThemeSchema), ctrl.saveThemeHandler);

router.post('/User/create', authenticate, validate(CreateUserSchema), ctrl.createUserHandler);
router.put('/User/update', authenticate, validate(UpdateUserSchema), ctrl.updateUserHandler);

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

// ── AMRole CRUD ───────────────────────────────────────────────────────────────
// Base: /t2.0/authentificationUtilization/AMRole

const AMRoleCreateSchema = z.object({
  RoleName: z.string().min(2),
  RoleLevel: z.number().int().min(1),
  Description: z.string().optional(),
});

const AMRoleUpdateSchema = z.object({
  RoleName: z.string().min(2).optional(),
  RoleLevel: z.number().int().min(1).optional(),
  Description: z.string().optional(),
  IsActive: z.boolean().optional(),
});

// POST /AMRole/list
router.post('/AMRole/list', authenticate, async (req, res, next) => {
  try { sendSuccess(res, await svc.listAMRoles(req.body)); } catch (e) { next(e); }
});

// POST /AMRole/create
router.post('/AMRole/create', authenticate, validate(AMRoleCreateSchema), async (req, res, next) => {
  try { sendSuccess(res, await svc.createAMRole(req.body), 201); } catch (e) { next(e); }
});

// GET  /AMRole/:roleId
router.get('/AMRole/:roleId', authenticate, ctrl.getRoleHandler);

// POST /AMRole/update/:id
router.post('/AMRole/update/:id', authenticate, validate(AMRoleUpdateSchema), async (req, res, next) => {
  try {
    sendSuccess(res, await svc.updateAMRole(Number(req.params['id']), req.body));
  } catch (e) { next(e); }
});

// POST /v2.0/authentification/AMRole/status  (Java uses this different prefix — mount here too)
// Note: mounted on the same router at BASE; actual path becomes
//       /t2.0/authentificationUtilization/AMRole/status via app.ts
router.post('/AMRole/status', authenticate, async (req, res, next) => {
  try {
    sendSuccess(res, await svc.updateAMRoleStatus(req.body));
  } catch (e) { next(e); }
});

// POST /AMRole/archive
router.post('/AMRole/archive', authenticate, async (req, res, next) => {
  try {
    sendSuccess(res, await svc.archiveAMRole(req.body));
  } catch (e) { next(e); }
});

export default router;
