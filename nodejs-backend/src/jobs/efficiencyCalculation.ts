/**
 * Daily efficiency calculation
 *
 * Port of Java EfficiencyServiceImpl.calculateAndSaveDailyEfficiency (GET /calculateAll).
 * Rebuilds EfficiencyUtilizationSummary, the table every efficiency report and dashboard reads, from the
 * work entries: one row per user, department and day, plus a row for every TAM account that went live
 * (department 23) and for every closed-position goal (department 22).
 *
 * The rules for each row are in calculations/calculationLogic.ts (calculateEfficiency); this file loads the
 * data, calls them and saves the rows.
 *
 * Runs every day at 6:00 AM IST, and when /calculateAll is called. Unlike Java, which truncates the table and
 * then saves row by row, the old rows are replaced in one transaction: a failure leaves the table as it was.
 */
import cron from 'node-cron';
import type mysql from 'mysql2/promise';
import { pool } from '../config/db';
import { logger } from '../config/logger';
import { calculateEfficiency, num, type EfficiencyResult, type DailyGoalData } from '../modules/calculations/calculationLogic';

type Row = mysql.RowDataPacket;

export interface SummaryRow extends EfficiencyResult {
  userId: number;
  departmentId: number;
  /** YYYY-MM-DD */
  workDate: string;
}

const none = (): DailyGoalData => ({ average: 0, dept19: { achieved67: 0, achieved68: 0, fixed67: 0, fixed68: 0 }, totals: { fixed: 0, achieved: 0 } });

/** Work out every row of the summary table from the current data, without saving anything */
export async function buildSummaryRows(): Promise<SummaryRow[]> {
  const [[days], [average], [dept19], [totals], [live], [closed]] = await Promise.all([
    pool.query<Row[]>(
      `SELECT u.UserID, u.DepartmentID, DATE_FORMAT(u.WorkDate, '%Y-%m-%d') AS WorkDate,
              SUM(CASE WHEN u.IsForTarget = 0 THEN COALESCE(u.AllocatedTime / 60, 0.0) ELSE 0.0 END) AS TotalAllocatedTime,
              SUM(CASE WHEN u.IsForTarget = 0 THEN COALESCE(u.TimeTakenToWork / 60, 0.0) ELSE 0.0 END) AS TotalTimeTaken,
              AVG(CASE WHEN u.IsForTarget = 1 AND u.Units > 0 THEN
                    CASE WHEN u.DepartmentID IN (59, 60, 61) AND u.AchivedUnits > u.Units
                         THEN (u.AchivedUnits * 100.0 / u.Units) - 10 ELSE (u.AchivedUnits * 100.0 / u.Units) END
                  ELSE NULL END) AS TargetAchievedPercent,
              MAX(u.IsHalfDayLeave) AS IsHalfDayLeave
       FROM UserWorkData u GROUP BY u.UserID, u.DepartmentID, u.WorkDate ORDER BY u.UserID, u.DepartmentID, u.WorkDate`),
    pool.query<Row[]>(
      `SELECT ug.UserID, DATE_FORMAT(ug.WorkDate, '%Y-%m-%d') AS d,
              COALESCE(ROUND(AVG(CASE WHEN ug.FixedGoal > 0 THEN (ug.AchievedGoal * 100.0) / ug.FixedGoal ELSE 0 END), 2), 0) AS v
       FROM UserGoalData ug GROUP BY ug.UserID, ug.WorkDate`),
    pool.query<Row[]>(
      `SELECT UserID, DATE_FORMAT(WorkDate, '%Y-%m-%d') AS d,
              COALESCE(SUM(CASE WHEN GoalID = 67 THEN AchievedGoal ELSE 0 END), 0) AS goal67,
              COALESCE(SUM(CASE WHEN GoalID = 68 THEN AchievedGoal ELSE 0 END), 0) AS goal68,
              COALESCE(SUM(CASE WHEN GoalID = 67 THEN FixedGoal ELSE 0 END), 0) AS fixed67,
              COALESCE(SUM(CASE WHEN GoalID = 68 THEN FixedGoal ELSE 0 END), 0) AS fixed68
       FROM UserGoalData WHERE DepartmentID = 19 GROUP BY UserID, WorkDate`),
    pool.query<Row[]>(
      `SELECT UserID, DATE_FORMAT(WorkDate, '%Y-%m-%d') AS d, COALESCE(SUM(FixedGoal), 0) AS fixed, COALESCE(SUM(AchievedGoal), 0) AS achieved
       FROM UserGoalData GROUP BY UserID, WorkDate`),
    pool.query<Row[]>(
      `SELECT created_by_user_id AS UserID, DATE_FORMAT(entry_date, '%Y-%m-%d') AS entry, DATE_FORMAT(live_date, '%Y-%m-%d') AS live
       FROM tam_accounts WHERE status = 'LIVE' AND live_date IS NOT NULL ORDER BY account_id`),
    pool.query<Row[]>(
      `SELECT ug.UserID, DATE_FORMAT(DATE(ug.ModifiedAt), '%Y-%m-%d') AS modified, ug.AchievedGoal
       FROM UserGoalData ug
       WHERE ug.DepartmentID = 22 AND ug.ModifiedAt IS NOT NULL
         AND ug.UserID IN (SELECT DISTINCT jp.CreatedByUserID FROM JobPositions jp WHERE jp.Status = 'CLOSED')`),
  ]);

  const key = (user: unknown, date: string) => `${user}|${date}`;
  const goals = new Map<string, DailyGoalData>();
  const goalOf = (user: unknown, date: string) => goals.get(key(user, date)) ?? goals.set(key(user, date), none()).get(key(user, date))!;
  for (const r of average) goalOf(r['UserID'], r['d']).average = num(r['v']);
  for (const r of dept19) goalOf(r['UserID'], r['d']).dept19 = { achieved67: num(r['goal67']), achieved68: num(r['goal68']), fixed67: num(r['fixed67']), fixed68: num(r['fixed68']) };
  for (const r of totals) goalOf(r['UserID'], r['d']).totals = { fixed: num(r['fixed']), achieved: num(r['achieved']) };

  // saved in this order, and a live account replaces a work-entry row of the same user, department 23 and day
  const rows = new Map<string, SummaryRow>();
  for (const r of days) {
    const userId = Number(r['UserID']);
    const departmentId = Number(r['DepartmentID']);
    const calc = calculateEfficiency({
      kind: 'day', departmentId, date: r['WorkDate'],
      allocatedHrs: num(r['TotalAllocatedTime']), timeTakenHrs: num(r['TotalTimeTaken']),
      averageUnitPercent: r['TargetAchievedPercent'] == null ? null : num(r['TargetAchievedPercent']),
      halfDayLeave: Number(r['IsHalfDayLeave']) === 1, goal: goals.get(key(userId, r['WorkDate'])) ?? none(),
    });
    rows.set(`${userId}|${departmentId}|${r['WorkDate']}`, { userId, departmentId, workDate: r['WorkDate'], ...calc });
  }
  for (const a of live) {
    if (!a['entry']) { logger.warn({ userId: a['UserID'], live: a['live'] }, 'Live TAM account has no entry date, skipped'); continue; }
    const userId = Number(a['UserID']);
    rows.set(`${userId}|23|${a['live']}`, { userId, departmentId: 23, workDate: a['live'], ...calculateEfficiency({ kind: 'liveAccount', entryDate: a['entry'], liveDate: a['live'] }) });
  }
  const result = [...rows.values()];
  // closed-position goals are always added as their own rows
  for (const g of closed) {
    result.push({ userId: Number(g['UserID']), departmentId: 22, workDate: g['modified'], ...calculateEfficiency({ kind: 'positionClosed', achievedGoal: num(g['AchievedGoal']) }) });
  }
  return result;
}

let running = false;

/** Rebuild the summary table. dryRun works the rows out and returns them without touching the table. */
export async function calculateAndSaveDailyEfficiency(options: { dryRun?: boolean } = {}) {
  if (running) return { skipped: true as const, reason: 'A calculation is already running' };
  running = true;
  const startedAt = Date.now();
  try {
    const rows = await buildSummaryRows();
    if (options.dryRun) return { skipped: false as const, saved: 0, rows };

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM EfficiencyUtilizationSummary');
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        await conn.query(
          `INSERT INTO EfficiencyUtilizationSummary
             (UserID, DepartmentID, WorkDate, AllocatedTimeHrs, TotalTimeOfWork, TargetAchievedPercent, EfficiencyLevel, UtilizationPercent, DayType, DataStatus)
           VALUES ?`,
          [batch.map((r) => [r.userId, r.departmentId, r.workDate, r.allocatedHrs, r.timeTakenHrs, r.targetAchievedPercent, r.efficiencyLevel, r.utilizationPercent, 'Working', 'Draft'])],
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    logger.info({ rows: rows.length, ms: Date.now() - startedAt }, 'Efficiency and utilization summary calculated and saved');
    return { skipped: false as const, saved: rows.length };
  } finally {
    running = false;
  }
}

export function scheduleEfficiencyCalculation(): void {
  cron.schedule('0 6 * * *', () => {
    calculateAndSaveDailyEfficiency().catch((err) => logger.error({ err }, 'Daily efficiency calculation failed'));
  }, { timezone: 'Asia/Kolkata' });
  logger.info('Daily efficiency calculation scheduled (6:00 AM IST)');
}
