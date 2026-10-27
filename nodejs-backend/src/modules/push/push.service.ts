import webpush from 'web-push';
import { pool } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { logger } from '../../config/logger';
import type mysql from 'mysql2/promise';

// Initialise VAPID keys on module load
webpush.setVapidDetails(
  `mailto:${env.VAPID_EMAIL}`,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY,
);

// ── Subscriptions ─────────────────────────────────────────────────────────────
export async function saveSubscription(input: {
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  // Upsert so re-subscribing on the same device just refreshes the keys
  await pool.execute(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE p256dh = VALUES(p256dh), auth = VALUES(auth), updated_at = NOW()`,
    [input.user_id, input.endpoint, input.p256dh, input.auth],
  );
  return { message: 'Subscription saved' };
}

export async function removeSubscription(endpoint: string) {
  await pool.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
  return { message: 'Subscription removed' };
}

export async function getSubscriptionsByUser(userId: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT * FROM push_subscriptions WHERE user_id = ?',
    [userId],
  );
  return rows;
}

// ── Send helpers ──────────────────────────────────────────────────────────────
interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  data?: Record<string, unknown>;
}

async function sendToSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return true;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      // Subscription expired — clean up
      await pool.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
      logger.info({ endpoint: sub.endpoint }, 'Expired push subscription removed');
    } else {
      logger.warn({ err, endpoint: sub.endpoint }, 'Push notification failed');
    }
    return false;
  }
}

export async function sendToUser(userId: number, payload: PushPayload) {
  const subs = await getSubscriptionsByUser(userId);
  if (!subs.length) return { sent: 0, message: 'No subscriptions for user' };

  const results = await Promise.allSettled(
    subs.map(s => sendToSubscription(s as { endpoint: string; p256dh: string; auth: string }, payload)),
  );
  const sent = results.filter(r => r.status === 'fulfilled' && r.value).length;
  return { sent, total: subs.length };
}

export async function broadcastNotification(input: {
  user_ids?: number[];
  payload: PushPayload;
}) {
  let subs: mysql.RowDataPacket[];
  if (input.user_ids?.length) {
    const placeholders = input.user_ids.map(() => '?').join(',');
    [subs] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM push_subscriptions WHERE user_id IN (${placeholders})`,
      input.user_ids,
    );
  } else {
    [subs] = await pool.execute<mysql.RowDataPacket[]>('SELECT * FROM push_subscriptions');
  }
  if (!subs.length) return { sent: 0, total: 0 };

  const results = await Promise.allSettled(
    subs.map(s => sendToSubscription(s as { endpoint: string; p256dh: string; auth: string }, input.payload)),
  );
  const sent = results.filter(r => r.status === 'fulfilled' && r.value).length;
  return { sent, total: subs.length };
}

// ── Stored notifications (in-app bell) ────────────────────────────────────────
export async function createNotification(input: {
  user_id: number;
  title: string;
  body: string;
  url?: string;
  type?: string;
}) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO notifications (user_id, title, body, url, type, is_read)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [input.user_id, input.title, input.body, input.url ?? null, input.type ?? 'general'],
  );
  // Also push in real-time if they have a subscription
  void sendToUser(input.user_id, { title: input.title, body: input.body, url: input.url });
  return { id: r.insertId, message: 'Notification created' };
}

export async function getUserNotifications(userId: number, unreadOnly = false) {
  const where = unreadOnly ? 'WHERE user_id = ? AND is_read = 0' : 'WHERE user_id = ?';
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT 50`,
    [userId],
  );
  return rows;
}

export async function markRead(notificationId: number, userId: number) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [notificationId, userId],
  );
  if (!r.affectedRows) throw AppError.notFound('Notification not found');
  return { message: 'Marked as read' };
}

export async function markAllRead(userId: number) {
  await pool.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
  return { message: 'All notifications marked as read' };
}
