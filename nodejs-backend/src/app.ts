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
import { departmentsRouter, primaryDepartmentsRouter } from './modules/departments/departments.routes';
import tasksRouter from './modules/tasks/tasks.routes';
import goalsRouter from './modules/goals/goals.routes';
import targetsRouter from './modules/targets/targets.routes';
import { monthlyRouter, quarterlyRouter, goalEfficiencyRouter } from './modules/reviews/reviews.routes';
import hrRouter, { queryRouter, engagementRouter, onboardingRouter } from './modules/hr/hr.routes';
import { salesCallsRouter, taCallsRouter, tamRouter } from './modules/sales/sales.routes';
import pushRouter from './modules/push/push.routes';
import adminRouter, { adminTicketsRouter, positionsRouter } from './modules/admin/admin.routes';
import reportsRouter from './modules/reports/reports.routes';
import metaRouter from './modules/users/users.routes';
import usersRouter from './modules/users/users.api.routes';
import monthlyTargetsRouter from './modules/targets/monthlyTargets.routes';
import formRouter from './modules/form/form.routes';
import userGoalDataRouter from './modules/userGoalData/userGoalData.routes';
import sprintEntryRouter from './modules/sprintEntry/sprintEntry.routes';
import techRouter from './modules/tech/tech.routes';

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

// ── API routes (exact Java URL paths — React frontend zero changes) ───────────
const BASE = '/t2.0/authentificationUtilization';

// ── Auth (login, users, AMRole) ───────────────────────────────────────────────
app.use(BASE, authRouter);

// ── Departments & PrimaryDepartments ─────────────────────────────────────────
// Java: /t2.0/authentificationUtilization/Department
app.use(`${BASE}/Department`, departmentsRouter);
app.use(`${BASE}/PrimaryDepartment`, primaryDepartmentsRouter);

// ── Department-scoped tasks / goals / targets ─────────────────────────────────
// Java: /t2.0/authentificationUtilization/departmentTasks
// Java: /t2.0/authentificationUtilization/departmentGoals
// Java: /t2.0/authentificationUtilization/departmentTargets
app.use(`${BASE}/departmentTasks`, tasksRouter);
app.use(`${BASE}/departmentGoals`, goalsRouter);
app.use(`${BASE}/departmentTargets`, targetsRouter);

// ── Monthly Targets ───────────────────────────────────────────────────────────
// Java: /t2.0/authentificationUtilization/monthly-targets
app.use(`${BASE}/monthly-targets`, monthlyTargetsRouter);

// ── Work data form entries ────────────────────────────────────────────────────
// Java: /t2.0/authentificationUtilization/form
app.use(`${BASE}/form`, formRouter);

// ── User goal data ────────────────────────────────────────────────────────────
// Java: /t2.0/authentificationUtilization/userGoalData
app.use(`${BASE}/userGoalData`, userGoalDataRouter);

// ── Sprint entries (createSprintEntry, updateSprint, getSprintEntry, labels) ──
// Java: /t2.0/authentificationUtilization/{createSprintEntry|updateSprint|...}
app.use(BASE, sprintEntryRouter);

// ── Tech sprints + stories ────────────────────────────────────────────────────
// Java: /t2.0/authentificationUtilization/tech
app.use(`${BASE}/tech`, techRouter);

// ── Reviews ───────────────────────────────────────────────────────────────────
// Java: /t2.0/authentificationUtilization/monthly-reviews
// Java: /t2.0/authentificationUtilization/quarterly-review
// Java: /t2.0/authentificationUtilization/goal-efficiency
app.use(`${BASE}/monthly-reviews`, monthlyRouter);
app.use(`${BASE}/quarterly-review`, quarterlyRouter);
app.use(`${BASE}/goal-efficiency`, goalEfficiencyRouter);

// ── HR Feedback ───────────────────────────────────────────────────────────────
// Java: /t2.0/authentificationUtilization/hrFeedback/query
// Java: /t2.0/authentificationUtilization/hrFeedback/engagement
// Java: /t2.0/authentificationUtilization/hrFeedback/onboarding
// Java: /t2.0/authentificationUtilization/hrFeedback/push (push notifications)
app.use(`${BASE}/hrFeedback/query`, queryRouter);
app.use(`${BASE}/hrFeedback/engagement`, engagementRouter);
app.use(`${BASE}/hrFeedback/onboarding`, onboardingRouter);
app.use(`${BASE}/hrFeedback/push`, pushRouter);
app.use(`${BASE}/hrFeedback`, hrRouter);  // legacy fallback

// ── Sales calls / TA calls / TAM accounts ────────────────────────────────────
// Java: /t2.0/authentificationUtilization/sales/calls
// Java: /t2.0/authentificationUtilization/ta/calls
// Java: /t2.0/authentificationUtilization/tam
app.use(`${BASE}/sales/calls`, salesCallsRouter);
app.use(`${BASE}/ta/calls`, taCallsRouter);
app.use(`${BASE}/tam`, tamRouter);

// ── Admin tickets ─────────────────────────────────────────────────────────────
// Java: /t2.0/authentificationUtilization/adminTickets
app.use(`${BASE}/adminTickets`, adminTicketsRouter);

// ── Job Positions ─────────────────────────────────────────────────────────────
// Java: /t2.0/authentificationUtilization/positions
app.use(`${BASE}/positions`, positionsRouter);

// ── Legacy admin router (audit, etc.) ────────────────────────────────────────
app.use(`${BASE}`, adminRouter);

// ── Dashboard + efficiency reports + combined work data ───────────────────────
// Java: /t2.0/authentificationUtilization/{various report endpoints}
app.use(BASE, reportsRouter);

// ── Meta/reference data ───────────────────────────────────────────────────────
app.use('/api/meta', metaRouter);

// ── Users (read-only) — Java: /api/users ─────────────────────────────────────
// Port of UserController: GET /api/users, GET /api/users/:id
app.use('/api/users', usersRouter);

// ── 404 + global error handler ────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
