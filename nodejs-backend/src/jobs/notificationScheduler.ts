/**
 * Every minute: sends the notifications written on the Notifications page whose time has come (scheduled once, or
 * weekly on a day and time), to the bells and, when they say so, by email.
 */
import cron from 'node-cron';
import { logger } from '../config/logger';
import { runDue, schedulerRan } from '../modules/notifications/notifications.service';

let running = false;

export function scheduleNotifications(): void {
  cron.schedule('* * * * *', () => {
    if (running) return; // a slow run (many emails) is never doubled up
    running = true;
    runDue()
      .then(async (n) => { if (n) logger.info({ sent: n }, 'Scheduled notifications sent'); await schedulerRan(); })
      .catch((err) => logger.error({ err }, 'Notification scheduler failed'))
      .finally(() => { running = false; });
  }, { timezone: 'Asia/Kolkata' });
  logger.info('Notification scheduler running (every minute)');
}
