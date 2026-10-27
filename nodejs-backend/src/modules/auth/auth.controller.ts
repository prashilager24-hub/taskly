import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { sendSuccess } from '../../utils/response';

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function getRoleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const roleId = Number(req.params['roleId']);
    const result = await authService.getRole(roleId);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function createUserHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.createUser(req.body, req.user!.role);
    sendSuccess(res, result, 201);
  } catch (err) { next(err); }
}

export async function updateUserHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.updateUser(req.body);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function getUsersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.getUsers(req.body);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function forgotPasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.forgotPassword(req.body);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function resetPasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.resetPassword(req.body);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function updateUserStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.updateUserStatus(req.body);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function archiveUsersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.archiveUsers(req.body);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function switchUserHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.switchUser(req.body.targetUserID, req.user!);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}
