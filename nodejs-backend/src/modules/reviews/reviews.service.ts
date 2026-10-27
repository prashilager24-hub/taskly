import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';

export async function getMonthlyReviews(filters: { emp_id?: number; month?: number; year?: number }) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (filters.emp_id) { conditions.push('mr.emp_id = ?'); params.push(filters.emp_id); }
  if (filters.month) { conditions.push('mr.month = ?'); params.push(filters.month); }
  if (filters.year) { conditions.push('mr.year = ?'); params.push(filters.year); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT mr.*, u.UserName, u.EmployeeID
     FROM MonthlyReview mr JOIN Users u ON u.UserID = mr.emp_id
     ${where} ORDER BY mr.year DESC, mr.month DESC`,
    params,
  );
  return rows.map(r => ({
    ...r,
    feedback: typeof r['feedback'] === 'string' ? JSON.parse(r['feedback'] as string) : r['feedback'],
    accessor: typeof r['accessor'] === 'string' ? JSON.parse(r['accessor'] as string) : r['accessor'],
  }));
}

export async function upsertMonthlyReview(input: {
  emp_id: number; month: number; year: number;
  target?: number; goal?: number; utilization?: number; efficiency?: number;
  feedback?: object; accessor?: object;
}) {
  await pool.execute(
    `INSERT INTO MonthlyReview (emp_id, month, year, target, goal, utilization, efficiency, feedback, accessor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       target = VALUES(target), goal = VALUES(goal),
       utilization = VALUES(utilization), efficiency = VALUES(efficiency),
       feedback = VALUES(feedback), accessor = VALUES(accessor)`,
    [
      input.emp_id, input.month, input.year,
      input.target ?? null, input.goal ?? null,
      input.utilization ?? null, input.efficiency ?? null,
      input.feedback ? JSON.stringify(input.feedback) : null,
      input.accessor ? JSON.stringify(input.accessor) : null,
    ],
  );
  return { message: 'Monthly review saved' };
}

export async function getQuarterlyReviews(filters: { emp_id?: number; quarter?: string; year?: number }) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (filters.emp_id) { conditions.push('qr.emp_id = ?'); params.push(filters.emp_id); }
  if (filters.quarter) { conditions.push('qr.quarter = ?'); params.push(filters.quarter); }
  if (filters.year) { conditions.push('qr.quarter_year = ?'); params.push(filters.year); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT qr.*, u.UserName, u.EmployeeID
     FROM QuarterlyReview qr JOIN Users u ON u.UserID = qr.emp_id
     ${where} ORDER BY qr.quarter_year DESC, qr.quarter`,
    params,
  );
  return rows.map(r => ({
    ...r,
    manager_ratings: typeof r['manager_ratings'] === 'string' ? JSON.parse(r['manager_ratings'] as string) : r['manager_ratings'],
    feedback: typeof r['feedback'] === 'string' ? JSON.parse(r['feedback'] as string) : r['feedback'],
    grade: typeof r['grade'] === 'string' ? JSON.parse(r['grade'] as string) : r['grade'],
  }));
}

export async function upsertQuarterlyReview(input: {
  emp_id: number; quarter: string; quarter_year: number;
  target_percent?: number; goal_achievement?: number; system_grade?: string;
  manager_avg_rating?: number; final_rating?: number;
  manager_ratings?: object; feedback?: object; grade?: object;
}) {
  await pool.execute(
    `INSERT INTO QuarterlyReview
       (emp_id, quarter, quarter_year, target_percent, goal_achievement, system_grade,
        manager_avg_rating, final_rating, manager_ratings, feedback, grade)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       target_percent = VALUES(target_percent), goal_achievement = VALUES(goal_achievement),
       system_grade = VALUES(system_grade), manager_avg_rating = VALUES(manager_avg_rating),
       final_rating = VALUES(final_rating), manager_ratings = VALUES(manager_ratings),
       feedback = VALUES(feedback), grade = VALUES(grade)`,
    [
      input.emp_id, input.quarter, input.quarter_year,
      input.target_percent ?? null, input.goal_achievement ?? null, input.system_grade ?? null,
      input.manager_avg_rating ?? null, input.final_rating ?? null,
      input.manager_ratings ? JSON.stringify(input.manager_ratings) : null,
      input.feedback ? JSON.stringify(input.feedback) : null,
      input.grade ? JSON.stringify(input.grade) : null,
    ],
  );
  return { message: 'Quarterly review saved' };
}

export async function getGoalEfficiency(filters: { UserID?: number; DepartmentID?: number }) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (filters.UserID) { conditions.push('ge.UserID = ?'); params.push(filters.UserID); }
  if (filters.DepartmentID) { conditions.push('ge.DepartmentID = ?'); params.push(filters.DepartmentID); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT ge.*, u.UserName FROM GoalEfficiency ge JOIN Users u ON u.UserID = ge.UserID ${where}
     ORDER BY ge.FromDate DESC`,
    params,
  );
  return rows;
}
