import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';
import { env } from '../config/env';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.id ?? 'unknown';

  if (err instanceof AppError && err.isOperational) {
    logger.warn({ requestId, err, path: req.path }, 'Operational error');
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.code ? { code: err.code } : {}),
    });
    return;
  }

  // Unexpected / programming error — log full stack
  logger.error({ requestId, err, path: req.path }, 'Unexpected error');

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
  });
}
