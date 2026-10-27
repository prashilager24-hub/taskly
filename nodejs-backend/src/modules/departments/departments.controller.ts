import { Request, Response, NextFunction } from 'express';
import * as svc from './departments.service';
import { sendSuccess } from '../../utils/response';

export async function list(_req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await svc.getAllDepartments()); } catch (e) { next(e); }
}
export async function getById(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await svc.getDepartmentById(Number(req.params['id']))); } catch (e) { next(e); }
}
export async function create(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await svc.createDepartment(req.body), 201); } catch (e) { next(e); }
}
export async function update(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await svc.updateDepartment(req.body)); } catch (e) { next(e); }
}
export async function getUsers(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await svc.getDepartmentUsers(Number(req.params['id']))); } catch (e) { next(e); }
}
export async function addUser(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await svc.addUserToDepartment(req.body)); } catch (e) { next(e); }
}
export async function removeUser(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await svc.removeUserFromDepartment(req.body)); } catch (e) { next(e); }
}
export async function primaryList(_req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await svc.getPrimaryDepartments()); } catch (e) { next(e); }
}
