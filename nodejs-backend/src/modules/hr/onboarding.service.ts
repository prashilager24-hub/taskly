import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/AppError';
import { sendMail } from '../../utils/mailer';

// ── Ported from Java OnboardingService (/hrFeedback/onboarding) — Support → Onboarding Experience ──
// HR sends new joiners a 7-question survey (scores 1–10): questions 1–4 rate the onboarding
// process, 5–7 the HR team. Employees submit once; HR and Admin see scores and breakdowns.

const QUESTION_LABELS = ['Onboarding process', 'Documentation', 'Training', 'Buddy/mentor', 'Team welcome', 'HR support', 'Overall experience'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Java's "d MMM yyyy", e.g. 7 Oct 2026 */
function fmtDate(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Accepts the same formats as Java: d MMM yyyy, yyyy-MM-dd, dd-MM-yyyy, dd/MM/yyyy */
function parseDate(input: string): string {
  const s = input.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/.exec(s);
  const month = m ? MONTHS.findIndex((x) => x.toLowerCase() === m![2]!.toLowerCase()) : -1;
  if (m && month >= 0) return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  throw AppError.badRequest(`Invalid date format: ${input}. Expected format: dd MMM yyyy (e.g. 30 Aug 2026)`);
}

function answersOf(raw: unknown): number[] {
  if (typeof raw !== 'string' || !raw) return Array.isArray(raw) ? (raw as number[]) : [];
  try {
    const a = JSON.parse(raw);
    return Array.isArray(a) ? a.map(Number) : [];
  } catch {
    return [];
  }
}

const isSubmitted = (s: mysql.RowDataPacket) => String(s['status']).toUpperCase() === 'SUBMITTED';

function employeeItem(s: mysql.RowDataPacket) {
  const answers = answersOf(s['answers']);
  return {
    id: s['id'],
    employee: s['employee_name'],
    dept: s['department'],
    joined: fmtDate(s['joined_date']),
    sentOn: fmtDate(s['sent_on']),
    due: fmtDate(s['due_date']),
    status: String(s['status']).toLowerCase(),
    answers,
    feedback: s['feedback'] ?? '',
    score: isSubmitted(s) && answers.length ? round1(avg(answers)) : null,
  };
}

function hrItem(s: mysql.RowDataPacket) {
  const base = employeeItem(s);
  const hrBlockAvg = isSubmitted(s) && base.answers.length >= 7 ? round1(avg(base.answers.slice(4, 7))) : null;
  return { ...base, hrBlockAvg };
}

async function notify(to: string[], subject: string, html: string) {
  try {
    await sendMail({ to, subject, html });
  } catch (err) {
    logger.warn({ err, subject }, 'Onboarding notification email failed');
  }
}

export async function getMine(employeeId: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT * FROM onboarding_surveys WHERE employee_id = ? ORDER BY sent_on DESC', [employeeId]);
  return { surveys: rows.map(employeeItem) };
}

export async function submitSurvey(employeeId: number, req: { surveyId: string; answers: number[]; feedback?: string | null }) {
  const [[survey]] = await pool.execute<mysql.RowDataPacket[]>('SELECT * FROM onboarding_surveys WHERE id = ?', [req.surveyId]);
  if (!survey) throw AppError.notFound(`Onboarding survey not found: ${req.surveyId}`);
  if (Number(survey['employee_id']) !== employeeId) throw AppError.badRequest('Survey does not belong to this employee');
  if (isSubmitted(survey)) throw AppError.badRequest('Survey already submitted');

  await pool.execute(
    "UPDATE onboarding_surveys SET answers = ?, feedback = ?, status = 'SUBMITTED', updated_at = NOW() WHERE id = ?",
    [JSON.stringify(req.answers), req.feedback ?? null, req.surveyId]);

  const a = req.answers;
  const overall = avg(a);
  const lowest = a.indexOf(Math.min(...a));
  await notify(['hr@tapmind.com', 'admin@tapmind.com'], `Onboarding Experience Survey submitted — ${survey['employee_name']}`,
    `<h3>Onboarding Survey Submitted</h3>
     <p><b>Employee:</b> ${survey['employee_name']} (${survey['department']})</p>
     <p><b>Overall Score:</b> ${round1(overall).toFixed(1)}/10</p>
     <p><b>Process Block Avg:</b> ${round1(avg(a.slice(0, 4))).toFixed(1)} | <b>HR Block Avg:</b> ${round1(avg(a.slice(4, 7))).toFixed(1)}</p>
     <p><b>Lowest Rated:</b> ${QUESTION_LABELS[lowest]} (${a[lowest]}/10)</p>
     <p><b>Feedback:</b> ${req.feedback || 'None'}</p>`);

  return { surveyId: req.surveyId, overallScore: round1(overall), submittedAt: new Date().toISOString().slice(0, 19) };
}

export async function getSurveysHR(status = 'all', dateRange?: string) {
  const filter = status && status.toLowerCase() !== 'all' ? status.toUpperCase() : 'ALL';
  const params: (string | number)[] = [filter, filter];
  let sql = "SELECT * FROM onboarding_surveys WHERE (? = 'ALL' OR status = ?)";
  if (dateRange && Number.isFinite(Number(dateRange))) {
    sql += ' AND sent_on >= CURDATE() - INTERVAL ? DAY';
    params.push(Number(dateRange));
  }
  const [rows] = await pool.query<mysql.RowDataPacket[]>(`${sql} ORDER BY sent_on DESC`, params);
  return { surveys: rows.map(hrItem) };
}

export async function getScores() {
  const [all] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM onboarding_surveys ORDER BY sent_on DESC');
  const submitted = all.filter(isSubmitted);
  const answers = submitted.map((s) => answersOf(s['answers'])).filter((a) => a.length);

  const questionAverages = Array.from({ length: 7 }, (_, i) =>
    submitted.length ? round1(answers.reduce((sum, a) => sum + (a[i] ?? 0), 0) / submitted.length) : 0);
  // Java divided the sum of every answer by the number of surveys (e.g. 51.5 "/10"); this is the
  // average of each survey's score, which is what the screen labels it as
  const overallAvg = answers.length ? round1(avg(answers.map(avg))) : 0;

  return {
    overallAvg,
    processBlockAvg: round1(avg(questionAverages.slice(0, 4))),
    hrBlockAvg: round1(avg(questionAverages.slice(4, 7))),
    responseRate: all.length ? Math.round((submitted.length * 100) / all.length) : 0,
    pending: all.length - submitted.length,
    scoresBelow6: answers.filter((a) => avg(a) < 6).length,
    submittedCount: submitted.length,
    distribution: Array(10).fill(0), // Java never fills the buckets
    questionAverages,
    q8Feedback: submitted
      .filter((s) => s['feedback'])
      .map((s) => ({ score: round1(avg(answersOf(s['answers']))), employee: s['employee_name'], dept: s['department'], feedback: s['feedback'] })),
  };
}

async function nextId(conn: mysql.PoolConnection) {
  const [[last]] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT id FROM onboarding_surveys WHERE id LIKE 'S-%' ORDER BY CAST(SUBSTRING(id, 3) AS UNSIGNED) DESC LIMIT 1 FOR UPDATE");
  const n = last ? Number(String(last['id']).replace('S-', '')) + 1 : 1;
  return `S-${String(n).padStart(3, '0')}`;
}

export async function sendSurvey(req: { recipients: string[]; dueDate: string; notifyList?: string | null; departmentOverrides?: Record<string, string> | null }) {
  const due = parseDate(req.dueDate);
  const ids: string[] = [];
  const emails: { email: string; name: string }[] = [];
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const name of req.recipients) {
      const [[user]] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT u.UserID, u.UserName, u.UserEmail,
                (SELECT d.DepartmentName FROM DepartmentUser du JOIN Department d ON d.DepartmentID = du.DepartmentID
                 WHERE du.UserID = u.UserID LIMIT 1) AS DepartmentName
         FROM Users u WHERE u.UserName = ? LIMIT 1`, [name]);
      if (!user) throw AppError.notFound(`User not found: ${name}`);
      const dept = req.departmentOverrides?.[name] ?? user['DepartmentName'] ?? '';
      const id = await nextId(conn);
      await conn.execute(
        `INSERT INTO onboarding_surveys (id, employee_id, employee_name, department, joined_date, sent_on, due_date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, CURDATE(), CURDATE(), ?, 'PENDING', NOW(), NOW())`,
        [id, user['UserID'], user['UserName'], dept, due]);
      ids.push(id);
      emails.push({ email: user['UserEmail'], name: user['UserName'] });
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  for (const r of emails) {
    await notify([r.email], 'Please complete your Onboarding Experience Survey',
      `<h3>Onboarding Experience Survey</h3><p>Hi ${r.name},</p>
       <p>Please complete your onboarding experience survey by <b>${req.dueDate}</b>.</p>
       <p>Click the link in Taskly to submit your feedback.</p>`);
  }
  await notify((req.notifyList || 'hr@tapmind.com').split(';').map((s) => s.trim()).filter(Boolean),
    `Onboarding Experience Survey sent to ${ids.length} employee(s)`,
    `<h3>Onboarding Surveys Sent</h3><p>Surveys sent to: ${req.recipients.join(', ')}</p><p>Due date: ${req.dueDate}</p>`);

  return { sent: ids.length, surveyIds: ids };
}

export async function getAdmin() {
  const [all] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM onboarding_surveys');
  const byDept = new Map<string, mysql.RowDataPacket[]>();
  for (const s of all) byDept.set(s['department'], [...(byDept.get(s['department']) ?? []), s]);

  let orgTotal = 0;
  let orgCount = 0;
  const departmentBreakdown = [...byDept.entries()].map(([dept, list]) => {
    const scores = list.filter(isSubmitted).map((s) => avg(answersOf(s['answers'])));
    const deptAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    if (scores.length) { orgTotal += deptAvg; orgCount++; }
    return { dept, sent: list.length, responded: scores.length, avg: round1(deptAvg), below6: scores.filter((x) => x < 6).length };
  }).sort((a, b) => a.avg - b.avg);

  const submitted = all.filter(isSubmitted).length;
  return {
    orgAvg: orgCount ? round1(orgTotal / orgCount) : 0,
    responseRate: all.length ? Math.round((submitted * 100) / all.length) : 0,
    lowestDept: departmentBreakdown[0] ?? null,
    highestDept: departmentBreakdown[departmentBreakdown.length - 1] ?? null,
    departmentBreakdown,
    notificationEmail: null,
  };
}
