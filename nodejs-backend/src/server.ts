import { env } from './config/env';
import { logger } from './config/logger';
import { testConnection } from './config/db';
import app from './app';

const server = app.listen(env.PORT, async () => {
  try {
    await testConnection();
    logger.info({ port: env.PORT }, '✅  Database connection OK');
    logger.info({ port: env.PORT }, `🚀  Taskly API listening on port ${env.PORT}`);
  } catch (err) {
    logger.fatal({ err }, '❌  Database connection failed — shutting down');
    process.exit(1);
  }
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10 s if connections linger
  setTimeout(() => {
    logger.error('Forcing exit after 10 s timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  process.exit(1);
});
