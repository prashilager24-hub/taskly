/**
 * User (read-only) API routes
 *
 * Port of Java UserController  → /api/users
 *
 * GET /api/users       — list all active, non-archived users with manager data
 * GET /api/users/:id   — get one user by ID
 *
 * Note: User creation / update / delete is owned by the existing
 * user-management module — NOT exposed here.
 */
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../utils/AppError';
import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';

const router = Router();
router.use(authenticate);

interface UserRow extends mysql.RowDataPacket {
  UserID: number;
  Name: string;
  UserEmail: string | null;
  EmployeeID: string | null;
  AppraisalCycle: string | null;
  FeedbackResolverTeam: string | null;
  ReportingManagerId: number | null;
  ReportingManagerName: string | null;
  ElManagerId: number | null;
  ElManagerName: string | null;
}

/**
 * Mirrors Java UserService.findAllActive()
 * Fetches active users together with their reporting manager and EL manager.
 */
async function findAllActiveUsers(): Promise<UserRow[]> {
  const [rows] = await pool.query<UserRow[]>(
    `SELECT
       u.UserID,
       u.UserName       AS Name,
       u.UserEmail,
       u.EmployeeID,
       u.AppraisalCycle,
       u.FeedbackResolverTeam,
       rm.UserID        AS ReportingManagerId,
       rm.UserName      AS ReportingManagerName,
       el.UserID        AS ElManagerId,
       el.UserName      AS ElManagerName
     FROM Users u
     LEFT JOIN Users rm ON rm.UserID = u.ReportingManagerID
     LEFT JOIN Users el ON el.UserID = u.ElManagerID
     WHERE u.IsActive = 1
       AND (u.IsUserArchived = 0 OR u.IsUserArchived IS NULL)
     ORDER BY u.UserName ASC`,
  );
  return rows;
}

// GET /api/users
router.get('/', async (_req, res, next) => {
  try {
    sendSuccess(res, await findAllActiveUsers());
  } catch (e) { next(e); }
});

// GET /api/users/:id
router.get('/:id', async (req, res, next) => {
  try {
    const userId = Number(req.params['id']);
    const users  = await findAllActiveUsers();
    const user   = users.find((u) => u.UserID === userId);
    if (!user) throw AppError.notFound(`Active user not found with id: ${userId}`);
    sendSuccess(res, user);
  } catch (e) { next(e); }
});

export default router;
