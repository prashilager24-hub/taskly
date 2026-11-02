import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { sendMail } from '../../utils/mailer';
import { AppError } from '../../utils/AppError';

type Row = mysql.RowDataPacket;

export interface Audience { all: boolean; departments: number[]; roles: number[]; users: number[] }
export type Repeat = 'NONE' | 'WEEKLY';
export interface NotificationInput {
  title: string; body?: string; level?: string; linkUrl?: string; audience: Partial<Audience>; expiresAt?: string | null; active?: boolean;
  /** 'YYYY-MM-DDTHH:MM' India time: goes out then instead of now */
  sendAt?: string | null;
  repeat?: Repeat; repeatDay?: number | null; repeatTime?: string | null;
  sendEmail?: boolean;
}

const LEVELS = ['info', 'success', 'warning', 'urgent'];
const IST = 330 * 60_000;
const ids = (xs: unknown) => (Array.isArray(xs) ? [...new Set(xs.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : []);
const audienceOf = (a: Partial<Audience>): Audience => ({ all: !!a.all, departments: ids(a.departments), roles: ids(a.roles), users: ids(a.users) });
const parse = (raw: unknown): Audience => { try { return audienceOf(JSON.parse(String(raw))); } catch { return audienceOf({}); } };

/** Who can see a notification: everyone, or anyone matching a department / role / person in its audience */
const AUDIENCE_SQL = `(
  JSON_EXTRACT(n.Audience, '$.all') = true
  OR JSON_CONTAINS(n.Audience, CAST(u.UserID AS JSON), '$.users')
  OR JSON_CONTAINS(n.Audience, CAST(u.RoleID AS JSON), '$.roles')
  OR EXISTS (SELECT 1 FROM Department d WHERE JSON_CONTAINS(n.Audience, CAST(d.DepartmentID AS JSON), '$.departments')
       AND (d.DepartmentID IN (SELECT DepartmentID FROM DepartmentUser WHERE UserID = u.UserID) OR d.ExecutiveLeaderID = u.UserID OR d.FunctionalLeaderID = u.UserID))
)`;

const shape = (r: Row) => ({
  id: r['NotificationID'] as number, title: r['Title'] as string, body: (r['Body'] as string) ?? '', level: r['Level'] as string,
  // in the bell a notification is dated by when it last went out (a weekly one comes back each week)
  linkUrl: (r['LinkUrl'] as string) ?? null, createdAt: (r['DeliveredAt'] as Date) ?? (r['CreatedAt'] as Date), expiresAt: (r['ExpiresAt'] as Date) ?? null,
});

// ── When a notification goes out (all times India time for people, UTC in the database) ─────────

/** The latest weekly slot at or before `now`: day 1 = Monday … 7 = Sunday, time 'HH:MM' India time */
export function lastWeekly(now: Date, day: number, time: string): Date {
  const ist = new Date(now.getTime() + IST);
  const [h, m] = time.split(':').map(Number) as [number, number];
  const dow = ((ist.getUTCDay() + 6) % 7) + 1;
  const slot = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - (dow - day), h, m));
  if (slot.getTime() > ist.getTime()) slot.setUTCDate(slot.getUTCDate() - 7);
  return new Date(slot.getTime() - IST);
}
export const nextWeekly = (now: Date, day: number, time: string) => new Date(lastWeekly(now, day, time).getTime() + 7 * 86_400_000);
/** 'YYYY-MM-DDTHH:MM' as India time → the moment */
const fromIst = (s: string) => new Date(`${s.length === 16 ? `${s}:00` : s}+05:30`);

/** What the signed-in person sees in the bell: meant for them, gone out, active, not expired, not closed by them.
 *  Appraisal notifications never show here: the appraisal's own screens (Budget Split's budget discussion) carry them. */
export async function mine(userId: number) {
  const [rows] = await pool.execute<Row[]>(
    `SELECT n.*, s.ReadAt FROM Notification n
       JOIN Users u ON u.UserID = ?
       LEFT JOIN NotificationState s ON s.NotificationID = n.NotificationID AND s.UserID = u.UserID
      WHERE n.IsActive = 1 AND n.Source <> 'APPRAISAL' AND n.DeliveredAt IS NOT NULL AND (n.ExpiresAt IS NULL OR n.ExpiresAt > ?) AND s.DismissedAt IS NULL AND ${AUDIENCE_SQL}
      ORDER BY n.DeliveredAt DESC LIMIT 50`, [userId, new Date()]);
  return rows.map((r) => ({ ...shape(r), read: !!r['ReadAt'] }));
}

async function mark(userId: number, notificationIds: number[], field: 'ReadAt' | 'DismissedAt') {
  for (const id of notificationIds) {
    await pool.execute(
      `INSERT INTO NotificationState (NotificationID, UserID, ${field}) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE ${field} = COALESCE(${field}, VALUES(${field}))`, [id, userId, new Date()]);
  }
}
export async function mark1(userId: number, id: number, what: 'read' | 'dismiss') {
  await mark(userId, [id], 'ReadAt');
  if (what === 'dismiss') await mark(userId, [id], 'DismissedAt');
}
export async function markAll(userId: number, what: 'read' | 'dismiss') {
  const idsNow = (await mine(userId)).map((n) => n.id);
  await mark(userId, idsNow, 'ReadAt');
  if (what === 'dismiss') await mark(userId, idsNow, 'DismissedAt');
}

/** How many active people an audience reaches (shown while composing) */
export async function reach(a: Partial<Audience>) {
  const [[r]] = await pool.execute<Row[]>(
    `SELECT COUNT(*) AS c FROM Users u JOIN (SELECT ? AS Audience) n WHERE u.IsUserArchived = 0 AND u.UserStatus = 1 AND ${AUDIENCE_SQL}`,
    [JSON.stringify(audienceOf(a))]);
  return Number(r?.['c'] ?? 0);
}

/** Where a notification stands, for the Notifications page */
function statusOf(r: Row, now = new Date()) {
  const expires = r['ExpiresAt'] as Date | null;
  if (!r['IsActive']) return 'PAUSED';
  if (expires && expires <= now) return 'ENDED';
  if (r['RepeatRule'] === 'WEEKLY') return 'WEEKLY';
  return r['DeliveredAt'] ? 'SENT' : 'SCHEDULED';
}

/** The notifications people wrote on the Notifications page (appraisal and system ones are not managed here) */
export async function list() {
  const [rows] = await pool.execute<Row[]>(
    `SELECT n.*, cu.UserName AS CreatedByName,
            (SELECT COUNT(*) FROM NotificationState s WHERE s.NotificationID = n.NotificationID AND s.ReadAt IS NOT NULL) AS ReadCount
       FROM Notification n LEFT JOIN Users cu ON cu.UserID = n.CreatedBy WHERE n.Source = 'MANUAL' ORDER BY n.CreatedAt DESC LIMIT 200`);
  const now = new Date();
  const out = [];
  for (const r of rows) {
    const audience = parse(r['Audience']);
    const weekly = r['RepeatRule'] === 'WEEKLY' && r['RepeatDay'] && r['RepeatTime'];
    out.push({
      ...shape(r), createdAt: r['CreatedAt'] as Date, active: !!r['IsActive'], audience, createdBy: r['CreatedByName'] ?? 'Admin', readCount: Number(r['ReadCount']), reach: await reach(audience),
      status: statusOf(r, now), sendAt: (r['SendAt'] as Date) ?? null, deliveredAt: (r['DeliveredAt'] as Date) ?? null,
      repeat: (r['RepeatRule'] as Repeat) ?? 'NONE', repeatDay: (r['RepeatDay'] as number) ?? null, repeatTime: (r['RepeatTime'] as string) ?? null,
      nextAt: weekly ? nextWeekly(now, r['RepeatDay'] as number, r['RepeatTime'] as string) : !r['DeliveredAt'] ? (r['SendAt'] as Date) ?? null : null,
      sendEmail: !!r['SendEmail'], emailedCount: Number(r['EmailedCount'] ?? 0),
    });
  }
  return out;
}

function clean(input: NotificationInput) {
  const title = input.title?.trim();
  if (!title) throw AppError.badRequest('Add a title');
  const audience = audienceOf(input.audience ?? {});
  if (!audience.all && !audience.departments.length && !audience.roles.length && !audience.users.length) throw AppError.badRequest('Choose who should get this');
  const expires = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expires && Number.isNaN(expires.getTime())) throw AppError.badRequest('That expiry date is not valid');
  const repeat: Repeat = input.repeat === 'WEEKLY' ? 'WEEKLY' : 'NONE';
  let sendAt: Date | null = null;
  if (repeat === 'NONE' && input.sendAt) {
    sendAt = fromIst(input.sendAt);
    if (Number.isNaN(sendAt.getTime())) throw AppError.badRequest('That send time is not valid');
    if (sendAt.getTime() <= Date.now()) sendAt = null; // a time already passed means now
  }
  if (repeat === 'WEEKLY') {
    if (!input.repeatDay || input.repeatDay < 1 || input.repeatDay > 7) throw AppError.badRequest('Choose the day of the week');
    if (!input.repeatTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.repeatTime)) throw AppError.badRequest('Choose the time');
  }
  return {
    title, body: input.body?.trim() || null, level: LEVELS.includes(input.level ?? '') ? input.level! : 'info', link: input.linkUrl?.trim() || null, audience, expires,
    sendAt, repeat, repeatDay: repeat === 'WEEKLY' ? input.repeatDay! : null, repeatTime: repeat === 'WEEKLY' ? input.repeatTime! : null, sendEmail: !!input.sendEmail,
  };
}

export async function create(actor: number, input: NotificationInput) {
  const c = clean(input);
  const active = input.active !== false;
  const [res] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO Notification (Title, Body, Level, LinkUrl, Audience, ExpiresAt, IsActive, CreatedBy, CreatedAt, Source, SendAt, RepeatRule, RepeatDay, RepeatTime, SendEmail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL', ?, ?, ?, ?, ?)`,
    [c.title, c.body, c.level, c.link, JSON.stringify(c.audience), c.expires, active ? 1 : 0, actor, new Date(), c.sendAt, c.repeat, c.repeatDay, c.repeatTime, c.sendEmail ? 1 : 0]);
  // not scheduled and not weekly: it goes out now
  if (active && !c.sendAt && c.repeat === 'NONE') await deliver(res.insertId);
  return res.insertId;
}

export async function update(id: number, input: NotificationInput) {
  const c = clean(input);
  const [[old]] = await pool.execute<Row[]>('SELECT DeliveredAt, RepeatRule FROM Notification WHERE NotificationID = ? AND Source = \'MANUAL\'', [id]) as unknown as [Row[]];
  if (!old) throw AppError.notFound('Notification not found');
  // moved to a later time, or made weekly from a one-off: it waits for its time again
  const resetDelivery = (c.sendAt && c.repeat === 'NONE') || (c.repeat === 'WEEKLY' && old['RepeatRule'] !== 'WEEKLY');
  await pool.execute(
    `UPDATE Notification SET Title = ?, Body = ?, Level = ?, LinkUrl = ?, Audience = ?, ExpiresAt = ?, IsActive = ?, SendAt = ?, RepeatRule = ?, RepeatDay = ?, RepeatTime = ?, SendEmail = ?
       ${resetDelivery ? ', DeliveredAt = NULL' : ''} WHERE NotificationID = ?`,
    [c.title, c.body, c.level, c.link, JSON.stringify(c.audience), c.expires, input.active === false ? 0 : 1, c.sendAt, c.repeat, c.repeatDay, c.repeatTime, c.sendEmail ? 1 : 0, id]);
  // a one-off that never went out and now has no future time goes out now
  if (input.active !== false && !c.sendAt && c.repeat === 'NONE' && !old['DeliveredAt']) await deliver(id);
}

export async function remove(id: number) {
  await pool.execute('DELETE FROM NotificationState WHERE NotificationID = ?', [id]);
  await pool.execute('DELETE FROM Notification WHERE NotificationID = ?', [id]);
}

/** The departments, roles and people an admin can aim a notification at */
export async function audienceOptions() {
  const [departments] = await pool.execute<Row[]>("SELECT DepartmentID AS id, DepartmentName AS name FROM Department WHERE IsDepartmentArchived = 0 AND DepartmentStatus = 1 ORDER BY DepartmentName");
  const [roles] = await pool.execute<Row[]>("SELECT RoleID AS id, RoleName AS name FROM AMRole ORDER BY RoleName");
  const [users] = await pool.execute<Row[]>(
    `SELECT u.UserID AS id, u.UserName AS name, u.UserEmail AS email,
            (SELECT GROUP_CONCAT(d.DepartmentName SEPARATOR ', ') FROM DepartmentUser du JOIN Department d ON d.DepartmentID = du.DepartmentID WHERE du.UserID = u.UserID) AS dept
       FROM Users u WHERE u.IsUserArchived = 0 AND u.UserStatus = 1 ORDER BY u.UserName`);
  return { departments, roles, users };
}

// ── Going out: to the bells, and by email ─────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

/** The email for a notification: its title, details and an Open in Taskly button to its link (or the app) */
export function emailHtml(title: string, body: string | null, link: string | null) {
  const url = !link ? env.FRONTEND_URL : /^https?:\/\//.test(link) ? link : `${env.FRONTEND_URL.replace(/\/$/, '')}${link.startsWith('/') ? '' : '/'}${link}`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#fafafa;padding:24px">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-collapse:collapse">
    <tr><td style="background:#000000;color:#ffffff;padding:16px 24px;font-weight:bold;letter-spacing:3px;font-size:14px">TASKLY</td></tr>
    <tr><td style="padding:24px">
      <p style="margin:0 0 12px;font-size:18px;font-weight:bold;color:#0b0b0b">${esc(title)}</p>
      ${body ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#3f3f46;white-space:pre-line">${esc(body)}</p>` : ''}
      <a href="${esc(url)}" style="display:inline-block;background:#ff6a1f;color:#ffffff;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:1px;text-transform:uppercase;padding:12px 20px">Open in Taskly</a>
    </td></tr>
    <tr><td style="padding:14px 24px;border-top:1px solid #f4f4f5;font-size:11px;color:#6a6a6a">You get this because it was sent to you in Taskly.</td></tr>
  </table>
</div>`;
}

/** Sends one notification out now: it shows (again) in every bell it is meant for, and is emailed when asked */
export async function deliver(id: number, at = new Date()) {
  const [[n]] = await pool.execute<Row[]>('SELECT * FROM Notification WHERE NotificationID = ?', [id]) as unknown as [Row[]];
  if (!n) return;
  // a weekly one comes back as new each week, even for people who closed last week's
  if (n['RepeatRule'] === 'WEEKLY') await pool.execute('DELETE FROM NotificationState WHERE NotificationID = ?', [id]);
  await pool.execute('UPDATE Notification SET DeliveredAt = ? WHERE NotificationID = ?', [at, id]);
  if (!n['SendEmail']) return;
  const [people] = await pool.execute<Row[]>(
    `SELECT u.UserEmail FROM Users u JOIN Notification n ON n.NotificationID = ?
      WHERE u.IsUserArchived = 0 AND u.UserStatus = 1 AND u.UserEmail IS NOT NULL AND u.UserEmail <> '' AND ${AUDIENCE_SQL}`, [id]);
  const emails = [...new Set(people.map((p) => p['UserEmail'] as string))];
  const html = emailHtml(n['Title'] as string, (n['Body'] as string) ?? null, (n['LinkUrl'] as string) ?? null);
  let sent = 0;
  // one email per person, so nobody sees the others' addresses
  for (const to of emails) {
    try { if (await sendMail({ to: [to], subject: n['Title'] as string, html })) sent++; }
    catch (err) { logger.error({ err, to, notification: id }, 'Notification email failed'); }
  }
  await pool.execute('UPDATE Notification SET EmailedCount = EmailedCount + ? WHERE NotificationID = ?', [sent, id]);
}

/** Every minute: scheduled notifications whose time has come, and weekly ones whose slot has come round */
export async function runDue(now = new Date()) {
  const [rows] = await pool.execute<Row[]>(
    `SELECT NotificationID, RepeatRule, RepeatDay, RepeatTime, SendAt, DeliveredAt, CreatedAt FROM Notification
      WHERE IsActive = 1 AND Source = 'MANUAL' AND (ExpiresAt IS NULL OR ExpiresAt > ?)
        AND ((RepeatRule = 'NONE' AND DeliveredAt IS NULL AND SendAt IS NOT NULL AND SendAt <= ?) OR RepeatRule = 'WEEKLY')`, [now, now]);
  let n = 0;
  for (const r of rows) {
    if (r['RepeatRule'] === 'WEEKLY') {
      if (!r['RepeatDay'] || !r['RepeatTime']) continue;
      const slot = lastWeekly(now, r['RepeatDay'] as number, r['RepeatTime'] as string);
      const done = r['DeliveredAt'] as Date | null;
      // a slot before the notification was written is not owed; each slot goes out once
      if (slot < (r['CreatedAt'] as Date) || (done && done >= slot)) continue;
    }
    await deliver(r['NotificationID'] as number, now);
    n++;
  }
  return n;
}

// ── Scheduled jobs that notify people on their own ────────────────────────────────────────────────

const setting = async (key: string) => {
  const [r] = await pool.execute<Row[]>('SELECT SettingValue FROM AppSetting WHERE SettingKey = ?', [key]);
  return (r[0]?.['SettingValue'] as string | undefined) ?? null;
};
const putSetting = (key: string, value: string) =>
  pool.execute('INSERT INTO AppSetting (SettingKey, SettingValue) VALUES (?, ?) ON DUPLICATE KEY UPDATE SettingValue = VALUES(SettingValue)', [key, value]);

/** Jobs whose email can be switched off on the Notifications page */
export const SYSTEM_JOBS = {
  // never sent before (the job could not run), so it starts switched off
  dailyTaskAudit: { name: 'Daily log report', when: 'Every day, 10:00', what: "Emails each reporting manager and EL the list of people who did and did not submit yesterday's daily log.", defaultOn: false },
} as const;
export type SystemJob = keyof typeof SYSTEM_JOBS;

export const jobEmailOn = async (job: SystemJob) => { const v = await setting(`job.${job}.email`); return v ? v === 'on' : SYSTEM_JOBS[job].defaultOn; };
export const jobRan = (job: SystemJob) => putSetting(`job.${job}.lastRun`, new Date().toISOString());

/** The system notifications: what each scheduled job sends, when, by which channel, and when it last ran */
export async function systemJobs() {
  const out = [];
  for (const [key, j] of Object.entries(SYSTEM_JOBS) as [SystemJob, (typeof SYSTEM_JOBS)[SystemJob]][]) {
    out.push({ key, name: j.name, when: j.when, what: j.what, channel: 'Email', email: await jobEmailOn(key), lastRun: await setting(`job.${key}.lastRun`), canToggle: true });
  }
  const [[sched]] = await pool.execute<Row[]>("SELECT COUNT(*) AS n FROM Notification WHERE Source = 'MANUAL' AND IsActive = 1 AND ((RepeatRule = 'NONE' AND DeliveredAt IS NULL AND SendAt IS NOT NULL) OR RepeatRule = 'WEEKLY')") as unknown as [Row[]];
  out.push({ key: 'notificationScheduler', name: 'Scheduled and weekly notifications', when: 'Every minute', what: `Sends the notifications written here at their time: ${Number(sched?.['n'] ?? 0)} waiting or repeating now. Each one is emailed when it says so.`, channel: 'Bell + email', email: true, lastRun: await setting('job.notificationScheduler.lastRun'), canToggle: false });
  return out;
}

export async function setJobEmail(job: string, on: boolean) {
  if (!(job in SYSTEM_JOBS)) throw AppError.notFound('No such job');
  await putSetting(`job.${job}.email`, on ? 'on' : 'off');
}

export const schedulerRan = () => putSetting('job.notificationScheduler.lastRun', new Date().toISOString());
