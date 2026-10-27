import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';

// ── Queries (HR ticket system) ────────────────────────────────────────────────
export async function getQueries(filters: { status?: string; UserID?: number }) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (filters.status) { conditions.push('q.status = ?'); params.push(filters.status); }
  if (filters.UserID) { conditions.push('q.raised_by = ?'); params.push(filters.UserID); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT q.*, u.UserName AS RaisedByName
     FROM queries q LEFT JOIN Users u ON u.UserID = q.raised_by
     ${where} ORDER BY q.created_at DESC`,
    params,
  );
  return rows;
}

export async function createQuery(input: { title: string; description: string; raised_by: number; category?: string }) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    "INSERT INTO queries (title, description, raised_by, category, status) VALUES (?, ?, ?, ?, 'OPEN')",
    [input.title, input.description, input.raised_by, input.category ?? null],
  );
  return { id: r.insertId, message: 'Query raised' };
}

export async function getQueryMessages(queryId: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT qm.*, u.UserName FROM query_messages qm
     JOIN Users u ON u.UserID = qm.sender_id
     WHERE qm.query_id = ? ORDER BY qm.created_at`,
    [queryId],
  );
  return rows;
}

export async function addQueryMessage(input: { query_id: number; sender_id: number; message: string }) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    'INSERT INTO query_messages (query_id, sender_id, message) VALUES (?, ?, ?)',
    [input.query_id, input.sender_id, input.message],
  );
  return { id: r.insertId, message: 'Message sent' };
}

export async function updateQueryStatus(queryId: number, status: string) {
  await pool.execute('UPDATE queries SET status = ? WHERE id = ?', [status, queryId]);
  return { message: 'Query status updated' };
}

// ── Engagement surveys ────────────────────────────────────────────────────────
export async function getSurveys() {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT * FROM engagement_surveys ORDER BY created_at DESC',
  );
  return rows;
}

export async function getSurveyResponses(surveyId: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT er.*, u.UserName FROM engagement_responses er
     JOIN Users u ON u.UserID = er.user_id
     WHERE er.survey_id = ?`,
    [surveyId],
  );
  return rows.map(r => ({
    ...r,
    responses: typeof r['responses'] === 'string' ? JSON.parse(r['responses'] as string) : r['responses'],
  }));
}

export async function submitSurveyResponse(input: { survey_id: number; user_id: number; responses: object }) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    'INSERT INTO engagement_responses (survey_id, user_id, responses) VALUES (?, ?, ?)',
    [input.survey_id, input.user_id, JSON.stringify(input.responses)],
  );
  return { id: r.insertId, message: 'Survey response submitted' };
}

// ── Onboarding surveys ────────────────────────────────────────────────────────
export async function getOnboardingSurveys(userId: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT * FROM onboarding_surveys WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
  );
  return rows;
}
