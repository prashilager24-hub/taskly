/**
 * Access Management → Users → "Send invitation": emails each chosen person a People Hub invitation with a new
 * temporary password and a button to the sign-in page. Their first sign-in with it skips the emailed code and makes
 * them set their own password (Users.MustChangePassword); after that two-factor sign-in works as usual.
 * A person's password changes only when their email was actually sent.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { sendMail } from '../../utils/mailer';
import { logChange } from './access.service';

/** 12 characters from an unambiguous set, always with a lower and upper case letter, a number and a symbol */
export function temporaryPassword(): string {
  const sets = ['abcdefghjkmnpqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '@#$%&*!?'];
  const all = sets.join('');
  const chars = [...sets.map((s) => s[crypto.randomInt(s.length)]!), ...Array.from({ length: 8 }, () => all[crypto.randomInt(all.length)]!)];
  for (let i = chars.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [chars[i], chars[j]] = [chars[j]!, chars[i]!]; }
  return chars.join('');
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The invitation, in the TapMind dark email style */
export function invitationEmail(o: { name: string; email: string; password: string; invitedBy: string; loginUrl: string; logoUrl: string }) {
  const font = "font-family:Arial,Helvetica,sans-serif";
  const mono = "font-family:'Courier New',Courier,monospace";
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#000000;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111111;border:1px solid #2a2a2a;">
    <tr><td style="padding:22px 32px;border-bottom:1px solid #2a2a2a;">
      <img src="${esc(o.logoUrl)}" alt="People Hub by TapMind" width="170" style="display:block;width:170px;height:auto;border:0;">
    </td></tr>
    <tr><td style="padding:32px 32px 8px 32px;${font};color:#ffffff;">
      <h1 style="margin:0 0 20px 0;font-size:24px;line-height:1.3;font-weight:900;letter-spacing:0.5px;text-transform:uppercase;color:#ffffff;">You're invited to People Hub</h1>
      <p style="margin:0 0 14px 0;font-size:14px;line-height:1.6;color:#e5e5e5;">Hi ${esc(o.name)},</p>
      <p style="margin:0 0 14px 0;font-size:14px;line-height:1.6;color:#e5e5e5;">${esc(o.invitedBy)} has invited you to <b style="color:#ffffff;">People Hub</b>, TapMind's home for your targets and goals, PMS, appraisal and variable pay.</p>
      <p style="margin:0 0 10px 0;font-size:14px;line-height:1.6;color:#e5e5e5;">Sign in with these details. You'll be asked to set your own password straight away.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;background:#000000;border:1px solid #2a2a2a;border-left:3px solid #FF6A1F;">
        <tr><td style="padding:12px 16px;${font};font-size:12px;color:#9a9a9a;text-transform:uppercase;letter-spacing:1px;">Email</td>
            <td style="padding:12px 16px;${mono};font-size:14px;color:#ffffff;">${esc(o.email)}</td></tr>
        <tr><td style="padding:0 16px 12px 16px;${font};font-size:12px;color:#9a9a9a;text-transform:uppercase;letter-spacing:1px;">Temporary password</td>
            <td style="padding:0 16px 12px 16px;${mono};font-size:16px;font-weight:bold;color:#FF7E01;letter-spacing:1px;">${esc(o.password)}</td></tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#FF6A1F;">
        <a href="${esc(o.loginUrl)}" style="display:inline-block;padding:15px 28px;${font};font-size:13px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#000000;text-decoration:none;">Open People Hub</a>
      </td></tr></table>
      <p style="margin:24px 0 24px 0;font-size:12px;line-height:1.6;color:#8a8a8a;">If you weren't expecting this invitation, you can ignore this email or tell your HR team. Never share your password with anyone.</p>
    </td></tr>
    <tr><td style="padding:16px 32px;border-top:1px solid #2a2a2a;${mono};font-size:11px;letter-spacing:1px;color:#6b6b6b;text-transform:uppercase;">
      &copy; ${new Date().getFullYear()} TapMind &mdash; automated message, please don't reply directly.
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

export interface InviteResult { userId: number; name: string; email: string; sent: boolean; reason?: string }

export async function sendInvitations(actorId: number, userIds: number[]): Promise<{ results: InviteResult[]; sent: number; failed: number }> {
  const ids = [...new Set(userIds)].filter((id) => id !== actorId);
  const [[me]] = await pool.execute<mysql.RowDataPacket[]>('SELECT UserName FROM Users WHERE UserID = ?', [actorId]);
  const invitedBy = String(me?.['UserName'] ?? 'Your Admin');
  const [users] = ids.length
    ? await pool.query<mysql.RowDataPacket[]>('SELECT UserID, UserName, UserEmail, UserStatus, IsUserArchived FROM Users WHERE UserID IN (?)', [ids])
    : [[] as mysql.RowDataPacket[]];
  const base = env.FRONTEND_URL.replace(/\/+$/, '');
  const results: InviteResult[] = [];
  for (const u of users) {
    const r: InviteResult = { userId: Number(u['UserID']), name: String(u['UserName']), email: String(u['UserEmail'] ?? ''), sent: false };
    if (Number(u['IsUserArchived']) === 1 || Number(u['UserStatus']) !== 1) { results.push({ ...r, reason: 'Inactive or archived' }); continue; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) { results.push({ ...r, reason: 'No valid email address' }); continue; }
    const password = temporaryPassword();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('UPDATE Users SET UserPassword = ?, MustChangePassword = 1, InvitedAt = NOW(), InvitedBy = ?, UserModifyTime = NOW() WHERE UserID = ?',
        [await bcrypt.hash(password, 12), actorId, r.userId]);
      const sent = await sendMail({
        to: [r.email],
        subject: 'You’re invited to People Hub',
        html: invitationEmail({ name: r.name, email: r.email, password, invitedBy, loginUrl: `${base}/`, logoUrl: `${base}/peoplehub-logo-email.png` }),
      });
      if (!sent) { await conn.rollback(); results.push({ ...r, reason: 'Email is not set up on the server (SMTP)' }); continue; }
      await conn.commit();
      results.push({ ...r, sent: true });
    } catch (err) {
      await conn.rollback().catch(() => undefined);
      logger.error({ err, userId: r.userId }, 'People Hub invitation failed');
      results.push({ ...r, reason: 'The email could not be sent' });
    } finally {
      conn.release();
    }
  }
  for (const id of ids) if (!results.some((x) => x.userId === id)) results.push({ userId: id, name: `User ${id}`, email: '', sent: false, reason: 'User not found' });
  const sent = results.filter((x) => x.sent).length;
  if (sent) await logChange(actorId, 'user', null, `Sent People Hub invitations to ${sent} ${sent === 1 ? 'person' : 'people'}: ${results.filter((x) => x.sent).map((x) => x.name).join(', ')}`);
  return { results, sent, failed: results.length - sent };
}
