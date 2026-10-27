import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
  redact: {
    paths: ['req.headers.authorization', '*.password', '*.token', '*.UserPassword'],
    censor: '[REDACTED]',
  },
  base: { service: 'taskly-api', env: env.NODE_ENV },
});
