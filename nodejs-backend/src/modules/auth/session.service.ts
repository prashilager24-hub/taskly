import crypto from 'crypto';
import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { sendMail } from '../../utils/mailer';
import { AppError } from '../../utils/AppError';

// Sessions, emailed one-time codes and the sign-in audit trail (requirements AUTH-01 – AUTH-10).

export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_AFTER_SECONDS = 30;
export const OTP_MAX_RESENDS = 3;

export interface ClientInfo {
  ip?: string | null;
  userAgent?: string | null;
}

export type AuthEventName =
  | 'PASSWORD_FAIL' | 'PASSWORD_OK' | 'OTP_SENT' | 'OTP_RESENT' | 'OTP_FAIL' | 'OTP_LOCKED'
  | 'OTP_OK' | 'SESSION_REPLACED' | 'LOGOUT';

export async function logAuthEvent(
  event: AuthEventName,
  who: { userId?: number | null; email?: string | null },
  client: ClientInfo,
  sessionId?: string | null,
) {
  try {
    await pool.execute(
      'INSERT INTO AuthEvent (UserID, Email, Event, SessionID, IPAddress, UserAgent) VALUES (?, ?, ?, ?, ?, ?)',
      [who.userId ?? null, who.email ?? null, event, sessionId ?? null, client.ip ?? null, client.userAgent?.slice(0, 255) ?? null],
    );
  } catch (err) {
    // Auditing must never block sign-in
    logger.error({ err, event }, 'Could not record auth event');
  }
}

// ── One-time codes ───────────────────────────────────────────────────────────

const hashCode = (code: string) => crypto.createHmac('sha256', env.JWT_SECRET).update(code).digest('hex');
const newCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

/** p•••@tapmind.com */
export function maskEmail(email: string) {
  const [name = '', domain = ''] = email.split('@');
  return `${name.slice(0, 1)}${'•'.repeat(Math.max(name.length - 1, 3))}@${domain}`;
}

/** Without SMTP in development the code is logged (and returned to the client) so sign-in still works */
const devOtpMode = () => env.NODE_ENV === 'development' && !env.SMTP_HOST;

async function emailCode(to: string, name: string, code: string) {
  if (devOtpMode()) logger.warn({ to, code }, 'DEV sign-in code (SMTP not configured)');
  await sendMail({
    to: [to],
    subject: `${code} is your Taskly sign-in code`,
    html: `<p>Hi ${name},</p>
<p>Your Taskly sign-in code is:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
<p>It expires in ${OTP_TTL_SECONDS / 60} minutes. If you did not try to sign in, change your password.</p>`,
  });
}

export async function createChallenge(
  user: { UserID: number; UserEmail: string; UserName: string },
  keepSignedIn: boolean,
) {
  const challengeId = crypto.randomUUID();
  const code = newCode();
  await pool.execute(
    `INSERT INTO LoginChallenge (ChallengeID, UserID, CodeHash, KeepSignedIn, LastSentAt, ExpiresAt)
     VALUES (?, ?, ?, ?, NOW(), NOW() + INTERVAL ? SECOND)`,
    [challengeId, user.UserID, hashCode(code), keepSignedIn ? 1 : 0, OTP_TTL_SECONDS],
  );
  await emailCode(user.UserEmail, user.UserName, code);
  return {
    challengeId,
    maskedEmail: maskEmail(user.UserEmail),
    expiresIn: OTP_TTL_SECONDS,
    resendAfter: OTP_RESEND_AFTER_SECONDS,
    ...(devOtpMode() ? { devOtp: code } : {}),
  };
}

async function loadChallenge(challengeId: string) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT c.*, c.ExpiresAt < NOW() AS Expired, TIMESTAMPDIFF(SECOND, c.LastSentAt, NOW()) AS SinceSent,
            u.UserEmail, u.UserName
     FROM LoginChallenge c JOIN Users u ON u.UserID = c.UserID
     WHERE c.ChallengeID = ?`,
    [challengeId],
  );
  const c = rows[0];
  if (!c || c['ConsumedAt']) throw AppError.badRequest('This sign-in attempt is no longer valid. Please sign in again.');
  return c;
}

/** Checks a code. Wrong codes count toward the attempt limit; the 5th wrong code locks the challenge. */
export async function verifyChallenge(challengeId: string, code: string, client: ClientInfo) {
  const c = await loadChallenge(challengeId);
  const who = { userId: c['UserID'] as number, email: c['UserEmail'] as string };
  if (Number(c['Expired'])) throw AppError.badRequest('This code has expired. Request a new one.');
  if (c['Attempts'] >= OTP_MAX_ATTEMPTS) throw AppError.badRequest('Too many wrong codes. Please sign in again.');

  const given = Buffer.from(hashCode(code.trim()), 'hex');
  const expected = Buffer.from(c['CodeHash'] as string, 'hex');
  if (!crypto.timingSafeEqual(given, expected)) {
    const attempts = (c['Attempts'] as number) + 1;
    await pool.execute('UPDATE LoginChallenge SET Attempts = ? WHERE ChallengeID = ?', [attempts, challengeId]);
    const left = OTP_MAX_ATTEMPTS - attempts;
    if (left <= 0) {
      await logAuthEvent('OTP_LOCKED', who, client);
      throw AppError.badRequest('Too many wrong codes. Please sign in again.');
    }
    await logAuthEvent('OTP_FAIL', who, client);
    throw AppError.badRequest(`That code is not correct. ${left} ${left === 1 ? 'try' : 'tries'} left.`);
  }

  // Single use
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    'UPDATE LoginChallenge SET ConsumedAt = NOW() WHERE ChallengeID = ? AND ConsumedAt IS NULL',
    [challengeId],
  );
  if (!r.affectedRows) throw AppError.badRequest('This sign-in attempt is no longer valid. Please sign in again.');
  return { userId: c['UserID'] as number, keepSignedIn: c['KeepSignedIn'] === 1 };
}

/** New code for the same challenge: after 30 s, at most 3 times; resets attempts and expiry */
export async function resendChallenge(challengeId: string, client: ClientInfo) {
  const c = await loadChallenge(challengeId);
  if (c['Attempts'] >= OTP_MAX_ATTEMPTS) throw AppError.badRequest('Too many wrong codes. Please sign in again.');
  if (c['Resends'] >= OTP_MAX_RESENDS) throw AppError.badRequest('No more codes can be sent. Please sign in again.');
  const wait = OTP_RESEND_AFTER_SECONDS - Number(c['SinceSent']);
  if (wait > 0) throw AppError.badRequest(`Please wait ${wait} seconds before requesting a new code.`);

  const code = newCode();
  await pool.execute(
    `UPDATE LoginChallenge SET CodeHash = ?, Attempts = 0, Resends = Resends + 1, LastSentAt = NOW(),
       ExpiresAt = NOW() + INTERVAL ? SECOND WHERE ChallengeID = ?`,
    [hashCode(code), OTP_TTL_SECONDS, challengeId],
  );
  await emailCode(c['UserEmail'] as string, c['UserName'] as string, code);
  await logAuthEvent('OTP_RESENT', { userId: c['UserID'] as number, email: c['UserEmail'] as string }, client);
  return {
    resendAfter: OTP_RESEND_AFTER_SECONDS,
    resendsLeft: OTP_MAX_RESENDS - (c['Resends'] as number) - 1,
    expiresIn: OTP_TTL_SECONDS,
    ...(devOtpMode() ? { devOtp: code } : {}),
  };
}

// ── Sessions ─────────────────────────────────────────────────────────────────

/** Starts a session (1 day, or 7 with "Keep me signed in") and ends any other active one */
export async function startSession(userId: number, keepSignedIn: boolean, client: ClientInfo) {
  const sessionId = crypto.randomUUID();
  const lifetimeHours = (keepSignedIn ? 7 : 1) * 24;
  // Expiry is set and compared in SQL (NOW()) so the DB's time zone can't skew it
  const expiresInSeconds = lifetimeHours * 3600;

  const [replaced] = await pool.execute<mysql.ResultSetHeader>(
    `UPDATE UserSession SET RevokedAt = NOW(), RevokedReason = 'REPLACED'
     WHERE UserID = ? AND RevokedAt IS NULL AND ExpiresAt > NOW()`,
    [userId],
  );
  if (replaced.affectedRows) await logAuthEvent('SESSION_REPLACED', { userId }, client);

  await pool.execute(
    `INSERT INTO UserSession (SessionID, UserID, KeepSignedIn, UserAgent, IPAddress, ExpiresAt)
     VALUES (?, ?, ?, ?, ?, NOW() + INTERVAL ? HOUR)`,
    [sessionId, userId, keepSignedIn ? 1 : 0, client.userAgent?.slice(0, 255) ?? null, client.ip ?? null, lifetimeHours],
  );
  return { sessionId, expiresInSeconds };
}

export type SessionState = 'ACTIVE' | 'REPLACED' | 'REVOKED' | 'EXPIRED' | 'UNKNOWN';

export async function sessionState(sessionId: string): Promise<SessionState> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT RevokedAt, RevokedReason, ExpiresAt < NOW() AS Expired FROM UserSession WHERE SessionID = ?',
    [sessionId],
  );
  const s = rows[0];
  if (!s) return 'UNKNOWN';
  if (s['RevokedAt']) return s['RevokedReason'] === 'REPLACED' ? 'REPLACED' : 'REVOKED';
  if (Number(s['Expired'])) return 'EXPIRED';
  return 'ACTIVE';
}

export async function revokeSession(sessionId: string, reason: 'LOGOUT', who: { userId: number }, client: ClientInfo) {
  await pool.execute(
    'UPDATE UserSession SET RevokedAt = NOW(), RevokedReason = ? WHERE SessionID = ? AND RevokedAt IS NULL',
    [reason, sessionId],
  );
  await logAuthEvent('LOGOUT', who, client, sessionId);
}
