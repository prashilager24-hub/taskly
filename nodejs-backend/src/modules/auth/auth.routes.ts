import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { authLimiter } from '../../middlewares/rateLimiter';
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
} from './auth.schema';
import * as ctrl from './auth.controller';

const router = Router();

// ── Public routes ─────────────────────────────────────────────────────────────
router.post('/authenticate', authLimiter, validate(LoginSchema), ctrl.loginHandler);
router.post('/forgotPassword', authLimiter, validate(ForgotPasswordSchema), ctrl.forgotPasswordHandler);
router.post('/resetPassword', authLimiter, validate(ResetPasswordSchema), ctrl.resetPasswordHandler);

// ── Authenticated routes ───────────────────────────────────────────────────────
router.get('/AMRole/:roleId', authenticate, ctrl.getRoleHandler);

router.post('/User/create', authenticate, validate(CreateUserSchema), ctrl.createUserHandler);
router.put('/User/update', authenticate, validate(UpdateUserSchema), ctrl.updateUserHandler);

router.post('/users/read', authenticate, validate(UsersReadSchema), ctrl.getUsersHandler);
router.post('/updateUserStatus', authenticate, validate(UpdateUserStatusSchema), ctrl.updateUserStatusHandler);
router.post('/usersArchive', authenticate, validate(ArchiveUsersSchema), ctrl.archiveUsersHandler);
router.post('/user/switch', authenticate, validate(SwitchUserSchema), ctrl.switchUserHandler);

export default router;
