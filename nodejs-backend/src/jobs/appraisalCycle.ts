/**
 * Appraisal cycle job. Runs every day at 00:30 IST and moves every cycle along.
 * Each step is safe to run twice on the same day: cycles are created once per person and year,
 * a status only moves when its date condition holds, and each reminder is written to the audit trail and sent once.
 *
 *  1. start the April / October cycles   2. (date windows on) when the appeal window closes, each department goes to the Finance Head
 *  3. postponed hikes return to whoever decided them   4. reminder emails to people who have not appealed
 */
import cron from 'node-cron';
import type mysql from 'mysql2/promise';
import { pool } from '../config/db';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { sendMail } from '../utils/mailer';
import { addDays, todayIST } from '../modules/appraisal/appraisal.calc';
import { audit, ensureCycle, syncOpenCycles } from '../modules/appraisal/appraisal.service';
import { closeAppealWindows, returnPostponed } from '../modules/appraisal/appraisal.flow';

type Row = mysql.RowDataPacket;

/** Starts the April / October cycle for everyone it is due for (joined December to May: April; June to November: October) */
async function createCycles(today: string) {
  const [users] = await pool.execute<Row[]>(
    'SELECT UserID, EmployeeLevel FROM Users WHERE UserStatus = 1 AND IsUserArchived = 0 AND RoleID <> 1 AND DateOfJoining IS NOT NULL');
  let created = 0;
  for (const u of users) {
    if (!u['EmployeeLevel']) { logger.warn({ userId: u['UserID'] }, 'Appraisal: no level set, cycle skipped'); continue; }
    if (await ensureCycle(u['UserID'] as number, null, today)) created++;
  }
  return created;
}

/** Sends a reminder once: the audit row is the memory */
async function remind(cycleId: number, key: string, to: string | null, subject: string, html: string) {
  if (!to) return;
  const [seen] = await pool.execute<Row[]>('SELECT 1 FROM AppraisalAudit WHERE CycleID = ? AND Action = ? LIMIT 1', [cycleId, key]);
  if (seen.length) return;
  await sendMail({ to: [to], subject, html });
  await audit(pool, cycleId, null, key, { to });
}

const link = `${env.FRONTEND_URL}/appraisal`;
const body = (text: string) => `<p>${text}</p><p><a href="${link}">Open Appraisal</a></p>`;

async function reminders(today: string) {
  // Employee: day 10 and day 14 if the self review is not submitted
  for (const [day, key] of [[10, 'REMINDER_EMP_D10'], [14, 'REMINDER_EMP_D14']] as const) {
    const [rows] = await pool.execute<Row[]>(
      `SELECT c.CycleID, u.UserEmail FROM AppraisalCycle c JOIN Users u ON u.UserID = c.UserID
        WHERE c.Status = 'EMPLOYEE_OPEN' AND c.CycleStartDate = ?
          AND NOT EXISTS (SELECT 1 FROM AppraisalReview r WHERE r.CycleID = c.CycleID AND r.ReviewerRole = 'SELF' AND r.SubmittedAt IS NOT NULL)`, [addDays(today, -(day - 1))]);
    for (const r of rows) await remind(r['CycleID'], key, r['UserEmail'], 'Your appraisal form closes soon', body(`Your appraisal form is open until day 15 of your cycle. You have not submitted it yet.`));
  }
}

/** One run of the job. `today` is injectable so a run can be tried on any date. */
export async function runAppraisalCycle(today: string = todayIST()) {
  const created = await createCycles(today);
  await syncOpenCycles(true);
  // with date windows off (APPRAISAL_TIME_WINDOWS) a department goes to the Finance Head as soon as everyone has appealed
  const timed = env.APPRAISAL_TIME_WINDOWS;
  const closed = timed ? await closeAppealWindows(today) : 0;
  const returned = await returnPostponed(today);
  if (timed) await reminders(today);
  const summary = { today, created, departmentsReady: closed, returned };
  logger.info(summary, 'Appraisal job finished');
  return summary;
}

export function scheduleAppraisalJob() {
  if (!env.APPRAISAL_JOB_ENABLED) { logger.info('Appraisal job is switched off (APPRAISAL_JOB_ENABLED=false)'); return; }
  cron.schedule('30 0 * * *', () => { runAppraisalCycle().catch((err) => logger.error({ err }, 'Appraisal job failed')); }, { timezone: 'Asia/Kolkata' });
  logger.info('Appraisal job scheduled for 00:30 IST');
}
