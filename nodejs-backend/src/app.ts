import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { requestId } from './middlewares/requestId';
import { apiLimiter } from './middlewares/rateLimiter';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

// Route imports
import authRouter from './modules/auth/auth.routes';
import departmentsRouter from './modules/departments/departments.routes';
import tasksRouter from './modules/tasks/tasks.routes';
import goalsRouter from './modules/goals/goals.routes';
import targetsRouter from './modules/targets/targets.routes';
import sprintsRouter from './modules/sprints/sprints.routes';
import reviewsRouter from './modules/reviews/reviews.routes';
import hrRouter from './modules/hr/hr.routes';
import salesRouter from './modules/sales/sales.routes';
import pushRouter from './modules/push/push.routes';
import adminRouter from './modules/admin/admin.routes';

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  }),
);

// ── Body parser ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request ID + HTTP logging ─────────────────────────────────────────────────
app.use(requestId);
app.use(
  pinoHttp({
    logger,
    customProps: (req) => ({ requestId: (req as express.Request).id }),
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    },
  }),
);

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use(apiLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), env: env.NODE_ENV });
});

// ── API routes ────────────────────────────────────────────────────────────────
// Auth (keeps exact Java path so React frontend needs zero changes)
app.use('/t2.0/authentificationUtilization', authRouter);

// Feature modules
app.use('/t2.0/departments', departmentsRouter);
app.use('/t2.0/tasks', tasksRouter);
app.use('/t2.0/goals', goalsRouter);
app.use('/t2.0/targets', targetsRouter);
app.use('/t2.0/sprints', sprintsRouter);
app.use('/t2.0/reviews', reviewsRouter);
app.use('/t2.0/hr', hrRouter);
app.use('/t2.0/sales', salesRouter);
app.use('/t2.0/push', pushRouter);
app.use('/t2.0/admin', adminRouter);

// ── 404 + global error handler ────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
