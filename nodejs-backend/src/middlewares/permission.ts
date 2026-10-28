import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { can } from '../modules/access/access.service';
import type { Action } from '../modules/access/catalog';

/** Lets the request through only when the signed-in user holds `action` on `module` (role + department + own access). */
export function requireModule(module: string, action: Action = 'read') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userId = Number(req.user?.sub);
    if (!userId) return next(AppError.unauthorized('Please sign in'));
    can(userId, module, action)
      .then((ok) => (ok ? next() : next(AppError.forbidden(`You do not have access to ${module} (${action}).`))))
      .catch(next);
  };
}

const WRITE = /\/(create|update|status|archive|delete|upload|bulk)/i;

/** Blocks changes (create / update / status / archive …) to a module's endpoints; reads stay open for the forms that need them. */
export function guardWrites(module: string) {
  const check = requireModule(module, 'update');
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || !WRITE.test(req.path)) return next();
    return check(req, res, next);
  };
}
