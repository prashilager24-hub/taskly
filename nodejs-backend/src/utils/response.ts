import { Response } from 'express';

interface ApiResponse<T> {
  success: boolean;
  response?: T;
  message?: string;
  errors?: unknown;
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  const body: ApiResponse<T> = { success: true, response: data };
  return res.status(statusCode).json(body);
}

export function sendError(res: Response, message: string, statusCode = 500, errors?: unknown): Response {
  const body: ApiResponse<null> = { success: false, message, ...(errors ? { errors } : {}) };
  return res.status(statusCode).json(body);
}
