import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

// General API limiter — 300 req / 15 min per IP
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: () => env.NODE_ENV === 'test',
});

// Strict limiter for auth routes — 10 attempts / 15 min
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again in 15 minutes.' },
  skip: () => env.NODE_ENV === 'test',
});
