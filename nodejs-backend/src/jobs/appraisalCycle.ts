/**
 * Appraisal cycle job. Runs every day at 00:30 IST and moves every cycle along.
 * Each step is safe to run twice on the same day: cycles are created once per person and year,
 * a status only moves when its date condition holds, and each reminder is written to the audit trail and sent once.
 *
 *  1. create cycles on joining anniversaries   2. employee window closes (day 16)   3. assessor window closes (day 31)
 *  4. postponed offers return to the assessors   5. reminder emails
 */
import cron from 'node-cron';
import type mysql from 'mysql2/promise';
import { pool } from '../config/db';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { sendMail } from '../utils/mailer';
import { addDays, isAnniversary, todayIST } from '../modules/appraisal/appraisal.calc';
import { audit, insertCycle, isFinance, type Appraisee } from '../modules/appraisal/appraisal.service';

type Row = mysql.RowDataPacket;
const D = (col: string, alias: string) => `DATE_FORMAT(${col}, '%Y-%m-%d') AS ${alias}`;

async function createCycles(today: string) {
  const [users] = await pool.execute<Row[]>(
    `SELECT UserID, UserName, EmployeeLevel, CurrentAnnualCtc, ${D('DateOfJoining', 'Joined')} FROM Users
      WHERE UserStatus = 1 AND IsUserArchived = 0 AND RoleID <> 1 AND DateOfJoining IS NOT NULL`);
  let created = 0;
  for (const u of users) {
    if (!isAnniversary(u['Joined'] as string, today)) continue;
    // a joining date this very year is not an anniversary yet
    if ((u['Joined'] as string).slice(0, 4) === today.slice(0, 4)) continue;
    if (!u['EmployeeLevel']) { logger.warn({ userId: u['UserID'] }, 'Appraisal: no level set, cycle skipped'); continue; }
    if (await insertCycle(pool, u as unknown as Appraisee, today, null)) created++;
  }
  return created;
}

async function moveWhere(from: string, to: string, condition: string, condParams: unknown[], set = '', setParams: unknown[] = []) {
  const [rows] = await pool.query<Row[]>(`SELECT CycleID FROM AppraisalCycle WHERE Status = ? AND ${condition}`, [from, ...condParams]);
  for (const r of rows) {
    // the status is checked again in the UPDATE, so a second run (or a second server) cannot move it twice
    const [res] = await pool.query<mysql.ResultSetHeader>(`UPDATE AppraisalCycle SET Status = ?${set} WHERE CycleID = ? AND Status = ?`, [to, ...setParams, r['CycleID'], from]);
    if (res.affectedRows) await audit(pool, r['CycleID'] as number, null, 'STATUS_CHANGE', { from, to });
  }
  return rows.map((r) => r['CycleID'] as number);
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

async function reminders(today: string, enteredFinance: number[]) {
  // Employee: day 10 and day 14 if the self review is not submitted
  for (const [day, key] of [[10, 'REMINDER_EMP_D10'], [14, 'REMINDER_EMP_D14']] as const) {
    const [rows] = await pool.execute<Row[]>(
      `SELECT c.CycleID, u.UserEmail FROM AppraisalCycle c JOIN Users u ON u.UserID = c.UserID
        WHERE c.Status = 'EMPLOYEE_OPEN' AND c.CycleStartDate = ?
          AND NOT EXISTS (SELECT 1 FROM AppraisalReview r WHERE r.CycleID = c.CycleID AND r.ReviewerRole = 'SELF' AND r.SubmittedAt IS NOT NULL)`, [addDays(today, -(day - 1))]);
    for (const r of rows) await remind(r['CycleID'], key, r['UserEmail'], 'Your appraisal form closes soon', body(`Your appraisal form is open until day 15 of your cycle. You have not submitted it yet.`));
  }
  // Assessors: day 25 if their review is not submitted
  const [open] = await pool.execute<Row[]>(
    `SELECT c.CycleID, c.UserID, e.UserName, c.Assessor1UserID, c.Assessor2UserID FROM AppraisalCycle c JOIN Users e ON e.UserID = c.UserID
      WHERE c.Status = 'ASSESSOR_OPEN' AND c.AssessorWindowEnd = ?`, [addDays(today, 5)]);
  for (const c of open) {
    for (const [role, uid] of [['A1', c['Assessor1UserID']], ['A2', c['Assessor2UserID']]] as const) {
      if (!uid) continue;
      const [done] = await pool.execute<Row[]>('SELECT 1 FROM AppraisalReview WHERE CycleID = ? AND ReviewerRole = ? AND SubmittedAt IS NOT NULL', [c['CycleID'], role]);
      if (done.length) continue;
      const [em] = await pool.execute<Row[]>('SELECT UserEmail FROM Users WHERE UserID = ?', [uid]);
      await remind(c['CycleID'], `REMINDER_${role}_D25`, (em[0]?.['UserEmail'] as string) ?? null, `Appraisal review due: ${c['UserName']}`, body(`Your review of ${c['UserName']} is still open and closes in 5 days.`));
    }
  }
  // Finance: told when a cycle reaches their desk
  if (enteredFinance.length) {
    const ids = [...new Set([...(env.APPRAISAL_FINANCE_ROLE_IDS.split(',').map(Number).filter(Boolean))])].filter((r) => isFinance(r));
    if (!ids.length) { logger.warn('Appraisal: APPRAISAL_FINANCE_ROLE_IDS is empty, nobody to tell about FINANCE_REVIEW'); return; }
    const [fin] = await pool.query<Row[]>('SELECT UserEmail FROM Users WHERE RoleID IN (?) AND UserStatus = 1 AND IsUserArchived = 0', [ids]);
    for (const cid of enteredFinance) for (const f of fin) await remind(cid, `REMINDER_FIN_${(f['UserEmail'] as string).toLowerCase()}`, f['UserEmail'], 'Appraisal ready for budget approval', body('An appraisal has reached Finance for budget approval.'));
  }
}

/** One run of the job. `today` is injectable so a run can be tried on any date. */
export async function runAppraisalCycle(today: string = todayIST()) {
  const created = await createCycles(today);
  const toAssessors = await moveWhere('EMPLOYEE_OPEN', 'ASSESSOR_OPEN', 'CycleStartDate <= ?', [addDays(today, -15)]);
  const toFinance = await moveWhere('ASSESSOR_OPEN', 'FINANCE_REVIEW', 'AssessorWindowEnd < ?', [today]);
  const returned = await moveWhere('POSTPONED', 'ASSESSOR_OPEN', 'PostponedUntil <= ?', [today], ', AssessorWindowEnd = ?', [addDays(today, 14)]);
  await reminders(today, toFinance);
  const summary = { today, created, toAssessors: toAssessors.length, toFinance: toFinance.length, returned: returned.length };
  logger.info(summary, 'Appraisal job finished');
  return summary;
}

export function scheduleAppraisalJob() {
  if (!env.APPRAISAL_JOB_ENABLED) { logger.info('Appraisal job is switched off (APPRAISAL_JOB_ENABLED=false)'); return; }
  cron.schedule('30 0 * * *', () => { runAppraisalCycle().catch((err) => logger.error({ err }, 'Appraisal job failed')); }, { timezone: 'Asia/Kolkata' });
  logger.info('Appraisal job scheduled for 00:30 IST');
}
