/**
 * Monthly Targets routes — MonthlyTargetController port
 * Base: /t2.0/authentificationUtilization/monthly-targets
 */
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { sendSuccess } from '../../utils/response';
import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';

const router = Router();
router.use(authenticate);

// POST /monthly-targets/today/:departmentId
// Body: { openDate: "YYYY-MM-DD" }
router.post('/today/:departmentId', async (req, res, next) => {
  try {
    const departmentId = Number(req.params['departmentId']);
    const { openDate } = req.body as { openDate?: string };
    const date = openDate ?? new Date().toISOString().slice(0, 10);

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT dt.*, d.DepartmentName,
              COALESCE(SUM(wd.ActualWork), 0) AS actualWork,
              COALESCE(SUM(wd.Target), 0) AS plannedWork,
              ROUND(COALESCE(SUM(wd.ActualWork), 0) / NULLIF(SUM(wd.Target), 0) * 100, 2) AS completion
       FROM DepartmentTarget dt
       LEFT JOIN Department d ON d.DepartmentID = dt.DepartmentID
       LEFT JOIN UserWorkData wd
         ON wd.DepartmentID = dt.DepartmentID AND wd.WorkDate = ?
       WHERE dt.DepartmentID = ?
       GROUP BY dt.TargetID`,
      [date, departmentId],
    );
    sendSuccess(res, rows);
  } catch (e) { next(e); }
});

export default router;
