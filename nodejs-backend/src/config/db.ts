import mysql from 'mysql2/promise';
import { env } from './env';

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: env.DB_POOL_MAX,
  queueLimit: 0,
  timezone: '+00:00',
  charset: 'utf8mb4',
  decimalNumbers: false, // Keep DECIMAL as strings to avoid precision loss
  bigNumberStrings: true, // Keep BIGINT as strings to avoid precision loss
  supportBigNumbers: true,
});

export async function testConnection(): Promise<void> {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
}
