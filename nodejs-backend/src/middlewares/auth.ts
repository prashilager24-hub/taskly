import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { sessionState } from '../modules/auth/session.service';

export interface JwtPayload {
  sub: string;       // UserID
  email: string;     // UserEmail
  role: number;      // RoleID
  username: string;  // UserName
  sid?: string;      // Server-side session (UserSession.SessionID)
  iat?: number;
  exp?: number;
}

// Extend Express Request
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Missing or invalid Authorization header'));
  }

  const token = authHeader.slice(7);

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(AppError.unauthorized('Your session expired. Please sign in again.', 'SESSION_EXPIRED'));
    }
    return next(AppError.unauthorized('Invalid token', 'SESSION_INVALID'));
  }

  // The token must belong to a session that is still active: signing in on another device,
  // signing out, or expiry ends it immediately (AUTH-03, AUTH-04)
  if (!payload.sid) {
    return next(AppError.unauthorized('Please sign in again.', 'SESSION_INVALID'));
  }
  sessionState(payload.sid)
    .then((state) => {
      if (state === 'ACTIVE') {
        req.user = payload;
        return next();
      }
      const reasons: Record<string, [string, string]> = {
        REPLACED: ['You were signed out because your account was used on another device.', 'SESSION_REPLACED'],
        EXPIRED: ['Your session expired. Please sign in again.', 'SESSION_EXPIRED'],
        REVOKED: ['You have been signed out.', 'SESSION_REVOKED'],
        UNKNOWN: ['Please sign in again.', 'SESSION_INVALID'],
      };
      const [message, code] = reasons[state] ?? reasons['UNKNOWN']!;
      return next(AppError.unauthorized(message, code));
    })
    .catch(next);
}

/** Usage: authorize(1, 2) — pass allowed RoleIDs */
export function authorize(...roleIds: number[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(AppError.unauthorized());
    if (roleIds.length && !roleIds.includes(req.user.role)) {
      return next(AppError.forbidden('Insufficient permissions'));
    }
    next();
  };
}
