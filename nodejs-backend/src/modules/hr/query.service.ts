import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/AppError';
import { sendMail } from '../../utils/mailer';

// ── Ported from Java QueryService (/hrFeedback/query) — Support → Query & HR ──
// Employees raise queries to HR or L&D; the team replies, resolves or reassigns;
// the employee rates the support (6 scores, 1–10) which closes the query.
// SLA: a query open or in progress for more than 72 hours is overdue.

type Team = 'HR' | 'L_D';
const SLA_HOURS = 72;
const CATEGORIES = ['PAYROLL', 'LEAVE', 'ATTENDANCE', 'POLICY', 'BENEFITS', 'TRAINING', 'CERTIFICATION', 'NOMINATION', 'OTHER'];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH'];
const RATING_LABELS = ['Response time', 'Clarity', 'Helpfulness', 'Resolution quality', 'Communication', 'Support provided'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseTeam(value: unknown): Team {
  const v = String(value ?? '').toUpperCase();
  if (v === 'HR') return 'HR';
  if (v === 'L&D' || v === 'L_D' || v === 'LD') return 'L_D';
  throw AppError.badRequest(`Invalid team: ${value}`);
}
const teamLabel = (t: Team) => (t === 'L_D' ? 'L&D' : 'HR');
const teamEmail = (t: Team) => (t === 'HR' ? 'hr@tapmind.com' : 'ld@tapmind.com');

function parseEnum(value: unknown, allowed: string[], name: string) {
  const v = String(value ?? '').toUpperCase();
  if (!allowed.includes(v)) throw AppError.badRequest(`Invalid ${name}: ${value}`);
  return v;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function ratingsOf(raw: unknown): number[] | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const r = JSON.parse(raw);
    return Array.isArray(r) ? r.map(Number) : null;
  } catch {
    return null;
  }
}

/** "d MMM" */
function dayMonth(v: unknown) {
  const d = v instanceof Date ? v : new Date(String(v));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
/** "d MMM, HH:mm" */
function dayMonthTime(v: unknown) {
  const d = v instanceof Date ? v : new Date(String(v));
  return `${dayMonth(d)}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

async function loadQuery(id: string) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM queries WHERE id = ?', [id]);
  if (!rows.length) throw AppError.notFound(`Query not found: ${id}`);
  return rows[0]!;
}

async function threadOf(queryId: string) {
  const [msgs] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT author, text, created_at FROM query_messages WHERE query_id = ? ORDER BY created_at ASC, id ASC', [queryId]);
  return msgs.map((m) => ({ who: m['author'], at: dayMonthTime(m['created_at']), text: m['text'] }));
}

async function addMessage(queryId: string, author: string, text: string) {
  await pool.execute('INSERT INTO query_messages (query_id, author, text, created_at) VALUES (?, ?, ?, NOW())', [queryId, author, text]);
}

const isOpen = (s: string) => s === 'OPEN' || s === 'IN_PROGRESS';
const isDone = (s: string) => s === 'RESOLVED' || s === 'CLOSED';

async function notify(to: string, subject: string, html: string) {
  try {
    await sendMail({ to: [to], subject, html });
  } catch (err) {
    logger.warn({ err, subject }, 'Query notification email failed');
  }
}

async function employeeItem(q: mysql.RowDataPacket) {
  const ratings = ratingsOf(q['ratings']) ?? [];
  return {
    id: q['id'],
    employee: q['employee_name'],
    dept: q['department'],
    team: teamLabel(q['team']),
    category: q['category'],
    subject: q['subject'],
    priority: q['priority'],
    raisedOn: dayMonth(q['raised_on']),
    ageHrs: q['age_hours'] ?? 0,
    status: String(q['status']).toLowerCase(),
    ratings,
    ratingComment: q['rating_comment'] ?? '',
    supportScore: ratings.length ? round1(avg(ratings)) : null,
    thread: await threadOf(q['id']),
  };
}

export async function getMine(employeeId: number) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT * FROM queries WHERE employee_id = ? ORDER BY raised_on DESC, created_at DESC', [employeeId]);
  return { queries: await Promise.all(rows.map(employeeItem)) };
}

async function nextId() {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT MAX(CAST(SUBSTRING(id, 3) AS UNSIGNED)) AS n FROM queries WHERE id LIKE 'Q-%'");
  return `Q-${Math.max(Number(rows[0]?.['n'] ?? 0) + 1, 1001)}`;
}

export async function raiseQuery(
  employee: { id: number; name: string },
  req: { team: string; category: string; subject: string; description: string; priority?: string },
) {
  const team = parseTeam(req.team);
  const category = parseEnum(req.category, CATEGORIES, 'category');
  const priority = parseEnum(req.priority ?? 'NORMAL', PRIORITIES, 'priority');
  const id = await nextId();
  const subject = req.subject.trim();
  const description = req.description.trim();

  // Java sent an empty department here; the user's first department is more useful to the team
  const [[dept]] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT d.DepartmentName FROM DepartmentUser du JOIN Department d ON d.DepartmentID = du.DepartmentID
     WHERE du.UserID = ? LIMIT 1`, [employee.id]);
  const department = (dept?.['DepartmentName'] as string | undefined) ?? '';

  await pool.execute(
    `INSERT INTO queries (id, employee_id, employee_name, department, team, category, subject, description, priority,
       raised_on, age_hours, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), 0, 'OPEN', NOW(), NOW())`,
    [id, employee.id, employee.name, department, team, category, subject, description, priority],
  );
  await addMessage(id, employee.name, description);
  await notify(teamEmail(team), `New ${teamLabel(team)} Query: ${subject}`,
    `<h3>New Query Raised</h3><p><b>From:</b> ${employee.name} (${department})</p>
     <p><b>Category:</b> ${category} | <b>Priority:</b> ${priority}</p><p><b>Subject:</b> ${subject}</p>
     <p><b>Description:</b> ${description}</p>`);

  return {
    id, team, category, subject, priority, raisedOn: 'Today', status: 'open',
    thread: [{ who: employee.name, at: 'Today', text: description.length > 100 ? `${description.slice(0, 100)}...` : description }],
  };
}

export async function rateQuery(id: string, employeeId: number, req: { ratings: number[]; comment?: string | null }) {
  const q = await loadQuery(id);
  if (q['employee_id'] !== employeeId) throw AppError.badRequest('Query does not belong to this employee');
  const score = avg(req.ratings);
  await pool.execute(
    "UPDATE queries SET ratings = ?, rating_comment = ?, status = 'CLOSED', updated_at = NOW() WHERE id = ?",
    [JSON.stringify(req.ratings), req.comment ?? null, id]);
  if (score < 6) {
    await notify('admin@tapmind.com', `Low Support Score Alert: ${q['subject']}`,
      `<h3>Low Support Score</h3><p><b>Query:</b> ${q['subject']} (${id})</p><p><b>Team:</b> ${q['team']}</p>
       <p><b>Score:</b> ${round1(score)}/10</p><p><b>Comment:</b> ${req.comment || 'None'}</p>`);
  }
  return { queryId: id, status: 'closed', overallScore: round1(score) };
}

export async function getQueue(team: Team) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT * FROM queries WHERE team = ? ORDER BY raised_on DESC, created_at DESC', [team]);
  const rated = rows.map((q) => ratingsOf(q['ratings'])).filter((r): r is number[] => !!r);
  const avgScore = avg(rated.map(avg));

  const queries = await Promise.all(rows.map(async (q) => {
    const status = String(q['status']);
    const age = Number(q['age_hours'] ?? 0);
    return {
      id: q['id'],
      employee: q['employee_name'],
      subject: q['subject'],
      category: q['category'],
      status: status.toLowerCase(),
      ageHrs: age,
      overdue: age > SLA_HOURS && !isDone(status),
      raisedOn: dayMonth(q['raised_on']),
      // Java reported the team's average here, not the query's own score
      supportScore: q['ratings'] ? round1(avgScore) : null,
      replies: await threadOf(q['id']),
    };
  }));

  return {
    team,
    openCount: rows.filter((q) => isOpen(q['status'])).length,
    overdueCount: rows.filter((q) => isOpen(q['status']) && Number(q['age_hours']) > SLA_HOURS).length,
    resolvedClosedCount: rows.filter((q) => isDone(q['status'])).length,
    avgSupportScore: round1(avgScore),
    surveysCompleted: rated.length,
    slaHours: SLA_HOURS,
    queries,
  };
}

export async function reply(id: string, authorName: string, text: string) {
  const q = await loadQuery(id);
  await addMessage(id, authorName, text.trim());
  let status = String(q['status']);
  if (status === 'OPEN') {
    status = 'IN_PROGRESS';
    await pool.execute("UPDATE queries SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = ?", [id]);
  }
  return { queryId: id, status: status.toLowerCase(), thread: await threadOf(id) };
}

export async function resolve(id: string) {
  const q = await loadQuery(id);
  await pool.execute("UPDATE queries SET status = 'RESOLVED', updated_at = NOW() WHERE id = ?", [id]);
  const [[u]] = await pool.query<mysql.RowDataPacket[]>('SELECT UserEmail FROM Users WHERE UserID = ?', [q['employee_id']]);
  if (u) {
    await notify(u['UserEmail'], `Your query has been resolved: ${q['subject']}`,
      `<h3>Query Resolved</h3><p>Hi ${q['employee_name']},</p>
       <p>Your query <b>${q['subject']}</b> has been resolved by the ${teamLabel(q['team'])} team.</p>
       <p>Please rate the support experience in Taskly.</p>`);
  }
  return { queryId: id, status: 'resolved' };
}

/** Moves the query to the other team and reopens it */
export async function reassign(id: string) {
  const q = await loadQuery(id);
  const newTeam: Team = q['team'] === 'HR' ? 'L_D' : 'HR';
  await pool.execute("UPDATE queries SET team = ?, status = 'OPEN', updated_at = NOW() WHERE id = ?", [newTeam, id]);
  await addMessage(id, 'System', `Reassigned from ${teamLabel(q['team'])} to ${teamLabel(newTeam)}`);
  return { queryId: id, team: teamLabel(newTeam), status: 'open' };
}

export async function reopen(id: string, employeeId: number, reason?: string | null) {
  const q = await loadQuery(id);
  if (q['employee_id'] !== employeeId) throw AppError.badRequest('Query does not belong to this employee');
  await pool.execute(
    "UPDATE queries SET status = 'OPEN', age_hours = 0, reopen_reason = ?, updated_at = NOW() WHERE id = ?", [reason ?? null, id]);
  await addMessage(id, q['employee_name'], reason ? `Reopened by employee: ${reason}` : 'Reopened by employee');
  await notify(teamEmail(q['team']), `Query Reopened: ${q['subject']}`,
    `<h3>Query Reopened</h3><p><b>Query:</b> ${q['subject']} (${id})</p><p><b>Employee:</b> ${q['employee_name']}</p>
     <p><b>Reason:</b> ${reason || 'No reason provided'}</p>`);
  return { queryId: id, status: 'open', reopenReason: reason ?? null };
}

export async function getAdmin() {
  const [all] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM queries');
  const rated = all.map((q) => ({ q, r: ratingsOf(q['ratings']) })).filter((x): x is { q: mysql.RowDataPacket; r: number[] } => !!x.r);
  const low = rated.filter((x) => avg(x.r) < 6);

  // Per-question averages across rated queries (6 questions)
  const size = rated[0]?.r.length ?? 0;
  const questionAverages = size
    ? Array.from({ length: size }, (_, i) => round1(avg(rated.filter((x) => x.r.length > i).map((x) => x.r[i]!))))
    : Array(6).fill(0);

  // Count of rated queries per average score bucket 1–10
  const distribution = Array(10).fill(0);
  for (const x of rated) distribution[Math.min(9, Math.max(0, Math.trunc(avg(x.r)) - 1))]++;

  const byTeam = (['HR', 'L_D'] as Team[]).map((team) => {
    const qs = all.filter((q) => q['team'] === team);
    const teamRated = rated.filter((x) => x.q['team'] === team);
    return {
      team: teamLabel(team),
      raised: qs.length,
      resolved: qs.filter((q) => isDone(q['status'])).length,
      avg: round1(avg(teamRated.map((x) => avg(x.r)))),
      below6: teamRated.filter((x) => avg(x.r) < 6).length,
    };
  });

  return {
    avgSupportScore: round1(avg(rated.map((x) => avg(x.r)))),
    totalRaised: all.length,
    totalResolved: all.filter((q) => isDone(q['status'])).length,
    totalOpen: all.filter((q) => isOpen(q['status'])).length,
    slaBreached: all.filter((q) => isOpen(q['status']) && Number(q['age_hours']) > SLA_HOURS).length,
    scoresBelow6: low.length,
    questionAverages,
    distribution,
    byTeam,
    lowScoring: low.map(({ q, r }) => ({
      id: q['id'],
      team: teamLabel(q['team']),
      subject: q['subject'],
      avg: round1(avg(r)),
      weakest: RATING_LABELS[r.indexOf(Math.min(...r)) % RATING_LABELS.length],
      comment: q['rating_comment'],
    })),
  };
}
