import { Response } from 'express';

// Helpers for endpoints that must reproduce the Java backend's JSON exactly,
// because the frontend reads those shapes directly (see sendSuccess for the
// Node-native { success, response } envelope used elsewhere).

/** Java response DTO envelope: { status, statusCode, message, response? } */
export interface JavaResponse<T = unknown> {
  status: boolean;
  statusCode: number;
  message: string;
  response?: T;
}

export function javaOk<T>(message: string, response?: T): JavaResponse<T> {
  return { status: true, statusCode: 200, message, ...(response !== undefined ? { response } : {}) };
}

export function javaFail(statusCode: number, message: string): JavaResponse<never> {
  return { status: false, statusCode, message };
}

/** Send a Java-shaped body as-is. httpStatus defaults to 200, as most Java controllers returned. */
export function sendJava(res: Response, body: unknown, httpStatus = 200): Response {
  return res.status(httpStatus).json(body);
}

/** tinyint(1) → boolean (Java Boolean); null stays null */
export function toBool(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  return v === true || v === 1 || v === '1';
}

/** DECIMAL / BIGINT strings → number (Java BigDecimal / Long serialize as numbers) */
export function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/**
 * DATETIME/TIMESTAMP → Jackson's LocalDateTime format "YYYY-MM-DDTHH:mm:ss".
 * The pool runs with timezone '+00:00', so the UTC fields are the DB's wall-clock values.
 */
export function toLocalDateTime(v: unknown): string | null {
  if (!(v instanceof Date)) return v === null || v === undefined ? null : String(v);
  return v.toISOString().slice(0, 19);
}

/** The server's current local time as a LocalDateTime string (Java's `new Date()` / `LocalDateTime.now()`) */
export function nowLocalDateTime(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}
