/**
 * Nodemailer transport — uses SMTP_* env vars.
 * In dev, if SMTP_HOST is not set, mail is silently dropped with a log warning.
 */
import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

function createTransport() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    logger.warn('SMTP not configured — emails will be logged but not sent');
    return null;
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

const transport = createTransport();

export async function sendMail(opts: {
  to: string[];
  subject: string;
  html: string;
}) {
  if (!transport) {
    logger.info({ to: opts.to, subject: opts.subject }, 'SMTP not configured — mail skipped');
    return;
  }
  await transport.sendMail({
    from: env.SMTP_FROM,
    to: opts.to.join(', '),
    subject: opts.subject,
    html: opts.html,
  });
  logger.info({ to: opts.to, subject: opts.subject }, 'Mail sent');
}
