/**
 * Daily Task Entry Audit Job
 *
 * Port of Java: DailyTaskEntryScheduler + TaskEntryAuditService
 *
 * Runs every day at 10:00 AM IST (04:30 UTC).
 * For each department it checks which users submitted work entries
 * for the previous day, then emails their reporting manager and EL manager
 * with a submitted / pending table.
 *
 * Schedule: cron.schedule('30 4 * * *', runDailyAudit, { timezone: 'Asia/Kolkata' })
 * Called from server.ts on startup.
 */
import cron from 'node-cron';
import { pool } from '../config/db';
import { sendMail } from '../utils/mailer';
import { logger } from '../config/logger';
import type mysql from 'mysql2/promise';

interface UserRow extends mysql.RowDataPacket {
  UserID: number;
  UserName: string;
  UserEmail: string | null;
  ReportingManagerEmail: string | null;
  ReportingManagerName: string | null;
  ElManagerEmail: string | null;
  ElManagerName: string | null;
}

interface DeptRow extends mysql.RowDataPacket {
  DepartmentID: number;
  DepartmentName: string;
}

function buildEmailBody(
  deptName: string,
  submitted: { UserName: string }[],
  pending: { UserName: string }[],
): string {
  const submittedRows = submitted.length
    ? submitted
        .map(
          (u) =>
            `<tr><td>${u.UserName}</td><td>${deptName}</td></tr>`,
        )
        .join('')
    : `<tr><td colspan="2">No Employees Submitted Tasks</td></tr>`;

  const pendingRows = pending.length
    ? pending
        .map(
          (u) =>
            `<tr><td>${u.UserName}</td><td>${deptName}</td></tr>`,
        )
        .join('')
    : `<tr><td colspan="2">No Pending Employees</td></tr>`;

  const tableStyle = `border='1' cellpadding='8' cellspacing='0' style='border-collapse:collapse;width:100%'`;

  return `
<p>Dear Managers,</p>
<p>The following employees submitted their data in Taskly yesterday.
Kindly review the entries for your respective teams and approve their tasks.</p>
<br>
<table ${tableStyle}>
  <tr><th>Submitted Employees</th><th>Department</th></tr>
  ${submittedRows}
</table>
<br><br>
<p>Please also note that the following employees are yet to update their data in Taskly.</p>
<br>
<table ${tableStyle}>
  <tr><th>Pending Employees</th><th>Department</th></tr>
  ${pendingRows}
</table>
<br><br>
<p>Regards,<br>Taskly Team</p>
<br>
<small>N.B.: This is an automated email. Please do not reply to this message.</small>
`;
}

export async function runDailyAudit(): Promise<void> {
  logger.info('========== DAILY TASK AUDIT STARTED ==========');

  // Yesterday's date in YYYY-MM-DD
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const workDate = yesterday.toISOString().slice(0, 10);

  // Get all active departments
  const [departments] = await pool.query<DeptRow[]>(
    `SELECT DepartmentID, DepartmentName FROM Department WHERE IsActive = 1 ORDER BY DepartmentName`,
  );

  logger.info({ count: departments.length }, 'Departments to audit');

  for (const dept of departments) {
    try {
      logger.info({ dept: dept.DepartmentName }, 'Checking department');

      // Get all active users in this department with their managers
      const [users] = await pool.query<UserRow[]>(
        `SELECT
           u.UserID,
           u.UserName,
           u.UserEmail,
           rm.UserEmail  AS ReportingManagerEmail,
           rm.UserName   AS ReportingManagerName,
           el.UserEmail  AS ElManagerEmail,
           el.UserName   AS ElManagerName
         FROM Users u
         LEFT JOIN Users rm ON rm.UserID = u.ReportingManagerID
         LEFT JOIN Users el ON el.UserID = u.ElManagerID
         WHERE u.DepartmentID = ?
           AND u.IsActive = 1`,
        [dept.DepartmentID],
      );

      const submitted: { UserName: string }[] = [];
      const pending: { UserName: string }[] = [];
      const managerEmails = new Set<string>();

      for (const user of users) {
        try {
          // Did this user submit work data for yesterday?
          const [[exists]] = await pool.execute<mysql.RowDataPacket[]>(
            `SELECT 1 AS found FROM UserWorkData
             WHERE UserID = ? AND WorkDate = ? LIMIT 1`,
            [user.UserID, workDate],
          );

          if ((exists as mysql.RowDataPacket | undefined)?.['found']) {
            submitted.push({ UserName: user.UserName });
          } else {
            pending.push({ UserName: user.UserName });
          }

          if (user.ReportingManagerEmail) managerEmails.add(user.ReportingManagerEmail);
          if (user.ElManagerEmail) managerEmails.add(user.ElManagerEmail);
        } catch (err) {
          logger.error({ user: user.UserName, err }, 'Error checking user');
        }
      }

      logger.info(
        { dept: dept.DepartmentName, submitted: submitted.length, pending: pending.length },
        'Audit summary',
      );

      if (managerEmails.size === 0) {
        logger.info({ dept: dept.DepartmentName }, 'No manager emails found — skipping');
        continue;
      }

      const html = buildEmailBody(dept.DepartmentName, submitted, pending);

      await sendMail({
        to: [...managerEmails],
        subject: `Daily Task Entry Report - ${dept.DepartmentName}`,
        html,
      });
    } catch (err) {
      logger.error({ dept: dept.DepartmentName, err }, 'Error auditing department');
    }
  }

  logger.info('========== DAILY TASK AUDIT COMPLETED ==========');
}

/**
 * Register the cron schedule.
 * Called once from server.ts after DB pool is ready.
 */
export function scheduleDailyAudit(): void {
  // "0 0 10 * * ?" in Asia/Kolkata = "30 4 * * *" in UTC
  cron.schedule('30 4 * * *', () => {
    runDailyAudit().catch((err) =>
      logger.error({ err }, 'Daily audit job failed'),
    );
  }, { timezone: 'Asia/Kolkata' });

  logger.info('Daily task audit job scheduled (10:00 AM IST)');
}
