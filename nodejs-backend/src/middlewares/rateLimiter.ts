import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

// Locally every request arrives via the Vite proxy from one IP, so the
// production limits lock out the whole dev session — relax them outside prod.
const isProd = env.NODE_ENV === 'production';

// General API limiter — 300 req / 15 min per IP
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 300 : 10_000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: () => env.NODE_ENV === 'test',
});

// Strict limiter for auth routes — 10 attempts / 15 min
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 10 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again in 15 minutes.' },
  skip: () => env.NODE_ENV === 'test',
});
