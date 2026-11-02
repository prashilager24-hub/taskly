import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/AppError';
import { fmtDate, parseDate } from './onboarding.service';
import { parseSnapshot, snapshotFor, type QuestionSnapshot } from './surveyTemplates.service';

// ── Ported from Java EngagementService (/hrFeedback/engagement) — Support → Employee Engagement ──
// HR rolls a survey out each quarter. Every employee rates the quarter's engagement activities month by month
// (the template's monthly question), answers the template's other rating questions and may add a comment.
// Java had the three questions fixed; here they come from the survey's template (a copy is kept on the survey).

type Row = mysql.RowDataPacket;

const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function list<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw !== 'string' || !raw) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
}

/** What the survey asks: the monthly question, the other ratings (with their short labels) and the open question */
function structure(snapshot: QuestionSnapshot | null) {
  const q = snapshot?.questions;
  return {
    monthlyQuestion: q?.find((x) => x.kind === 'MONTHLY')?.text ?? 'How would you rate the HR engagement activities conducted during each month of this quarter?',
    rest: q ? q.filter((x) => x.kind === 'RATING') : [
      { text: "How would you rate HR's planning and execution of the engagement activities this quarter?", short: 'Planning & execution' },
      { text: 'How approachable and responsive was the HR team during these activities?', short: 'HR approachability' },
    ],
    textQuestion: q ? (q.find((x) => x.kind === 'TEXT')?.text ?? null) : 'What is one thing we could improve in our engagement activities?',
  };
}

const templateOf = (s: Row) => {
  const snap = parseSnapshot(s['Questions']);
  const st = structure(snap);
  return {
    templateId: s['TemplateID'] ?? null, templateName: snap?.name ?? null,
    monthlyQuestion: st.monthlyQuestion,
    restQuestions: st.rest.map((r) => ({ text: r.text, short: r.short || r.text })),
    textQuestion: st.textQuestion,
  };
};

const responsesOf = async (surveyId: string) => {
  const [rows] = await pool.query<Row[]>('SELECT * FROM engagement_responses WHERE survey_id = ? ORDER BY created_at ASC, id ASC', [surveyId]);
  return rows;
};

const rate = (count: number, sentTo: number) => (sentTo > 0 ? Math.round(((count * 100) / sentTo) * 10) / 10 : 0);

export async function getOpenSurveys(employeeId: number) {
  const [open] = await pool.query<Row[]>("SELECT * FROM engagement_surveys WHERE status = 'COLLECTING' ORDER BY opens DESC");
  const [mine] = await pool.query<Row[]>('SELECT survey_id FROM engagement_responses WHERE respondent_id = ?', [employeeId]);
  const done = new Set(mine.map((r) => r['survey_id']));
  return {
    surveys: open.map((s) => ({
      id: s['id'], quarter: s['quarter'], months: list<string>(s['months']), closes: fmtDate(s['closes']),
      status: String(s['status']).toLowerCase(), submitted: done.has(s['id']), ...templateOf(s),
    })),
  };
}

export async function submitResponse(employeeId: number, employeeName: string, req: { surveyId: string; months: number[]; rest: number[]; feedback?: string | null; anonymous?: boolean | null }) {
  const [[survey]] = await pool.query<Row[]>('SELECT * FROM engagement_surveys WHERE id = ?', [req.surveyId]);
  if (!survey) throw AppError.notFound(`Engagement survey not found: ${req.surveyId}`);
  const [[already]] = await pool.query<Row[]>('SELECT 1 AS x FROM engagement_responses WHERE survey_id = ? AND respondent_id = ? LIMIT 1', [req.surveyId, employeeId]);
  if (already) throw AppError.badRequest('You have already responded to this survey');

  const st = structure(parseSnapshot(survey['Questions']));
  const monthCount = list<string>(survey['months']).length;
  if (req.months.length !== monthCount) throw AppError.badRequest(`Rate each of the ${monthCount} months`);
  if (req.rest.length !== st.rest.length) throw AppError.badRequest(`Exactly ${st.rest.length} other ratings required`);

  await pool.execute(
    'INSERT INTO engagement_responses (survey_id, respondent_id, respondent_name, anonymous, months, rest, feedback, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
    [req.surveyId, employeeId, employeeName, req.anonymous ? 1 : 0, JSON.stringify(req.months), JSON.stringify(req.rest), req.feedback ?? null]);

  const combined = (avg(req.months) + avg(req.rest)) / 2;
  logger.info({ surveyId: req.surveyId, employeeId, score: combined }, 'Engagement response submitted');
  return { recorded: true, overallScore: round1(combined) };
}

export async function getSurveysHR(_fy?: string) {
  const [surveys] = await pool.query<Row[]>('SELECT * FROM engagement_surveys ORDER BY opens DESC, id DESC');
  return {
    surveys: await Promise.all(surveys.map(async (s) => {
      const responses = await responsesOf(s['id']);
      return {
        id: s['id'], quarter: s['quarter'], months: list<string>(s['months']), sentTo: s['sent_to'], opens: fmtDate(s['opens']), closes: fmtDate(s['closes']),
        status: String(s['status']).toLowerCase(), responseCount: responses.length, responseRate: rate(responses.length, Number(s['sent_to'])),
        ...templateOf(s),
        responses: responses.map((r) => ({
          by: r['anonymous'] ? 'Anonymous' : r['respondent_name'], anonymous: !!r['anonymous'],
          months: list<number>(r['months']), rest: list<number>(r['rest']), feedback: r['feedback'] ?? null,
        })),
      };
    })),
  };
}

export async function getScores(surveyId: string) {
  const [[survey]] = await pool.query<Row[]>('SELECT * FROM engagement_surveys WHERE id = ?', [surveyId]);
  if (!survey) throw AppError.notFound(`Engagement survey not found: ${surveyId}`);
  const responses = await responsesOf(surveyId);
  const monthLabels = list<string>(survey['months']);
  const st = structure(parseSnapshot(survey['Questions']));
  const months = responses.map((r) => list<number>(r['months']));
  const rests = responses.map((r) => list<number>(r['rest']));
  const column = (rows: number[][], i: number) => (rows.length ? round1(avg(rows.map((r) => (i < r.length ? r[i]! : 0)))) : 0);
  const overall = (i: number) => avg([...(months[i] ?? []), ...(rests[i] ?? [])]);

  const distribution = Array(10).fill(0) as number[];
  responses.forEach((_, i) => { const b = Math.min(9, Math.max(0, Math.trunc(overall(i)) - 1)); distribution[b]!++; });
  const comments = responses
    .map((r, i) => ({ r, score: round1(overall(i)) }))
    .filter(({ r }) => r['feedback'])
    .map(({ r, score }) => ({ score, feedback: r['feedback'], by: r['anonymous'] ? 'Anonymous' : r['respondent_name'] }));

  return {
    surveyId, quarter: survey['quarter'], quarterAvg: round1(avg(responses.map((_, i) => overall(i)))), responseCount: responses.length,
    sentTo: survey['sent_to'], responseRate: rate(responses.length, Number(survey['sent_to'])), monthLabels,
    monthAvgs: responses.length ? monthLabels.map((_, i) => column(months, i)) : [],
    restAvgs: responses.length ? st.rest.map((_, i) => column(rests, i)) : [],
    restLabels: st.rest.map((r) => r.short || r.text), commentCount: comments.length, distribution, comments,
  };
}

async function nextId() {
  const [[last]] = await pool.query<Row[]>("SELECT id FROM engagement_surveys WHERE id LIKE 'E-%' ORDER BY CAST(SUBSTRING(id, 3) AS UNSIGNED) DESC LIMIT 1");
  const n = last ? Number(String(last['id']).replace('E-', '')) + 1 : 1;
  return `E-${String(n).padStart(3, '0')}`;
}

export async function rollout(req: { quarter: string; months: string[]; closes: string; notifyList?: string | null; recipients?: unknown[]; templateId?: number | null }) {
  const snapshot = await snapshotFor('ENGAGEMENT', req.templateId);
  const closes = parseDate(req.closes);
  const [[users]] = await pool.query<Row[]>('SELECT COUNT(*) AS n FROM Users');
  const sentTo = Number(users?.['n'] ?? 0);
  const id = await nextId();
  await pool.execute(
    "INSERT INTO engagement_surveys (id, quarter, months, sent_to, opens, closes, status, created_at, TemplateID, Questions) VALUES (?, ?, ?, ?, CURDATE(), ?, 'COLLECTING', NOW(), ?, ?)",
    [id, req.quarter, JSON.stringify(req.months), sentTo, closes, snapshot.templateId, JSON.stringify(snapshot)]);
  logger.info({ id, quarter: req.quarter, sentTo }, 'Engagement survey rolled out');
  return { id, quarter: req.quarter, sentTo, status: 'collecting' };
}

export async function getAdmin() {
  const [all] = await pool.query<Row[]>('SELECT * FROM engagement_surveys ORDER BY opens DESC, id DESC');
  const quarterOnQuarter: { quarter: string; responseCount: number; sentTo: number; responseRate: number; activities: number; planning: number; approachability: number }[] = [];
  let totalAvg = 0;
  let totalRate = 0;
  for (const s of all) {
    const responses = await responsesOf(s['id']);
    const monthLabels = list<string>(s['months']);
    const months = responses.map((r) => list<number>(r['months']));
    const rests = responses.map((r) => list<number>(r['rest']));
    const mean = (rows: number[][], i: number) => avg(rows.map((r) => (i < r.length ? r[i]! : 0)));
    const monthAvgs = monthLabels.map((_, i) => round1(mean(months, i)));
    const activities = avg(monthAvgs);
    quarterOnQuarter.push({
      quarter: s['quarter'], responseCount: responses.length, sentTo: s['sent_to'], responseRate: rate(responses.length, Number(s['sent_to'])),
      activities: round1(activities), planning: round1(mean(rests, 0)), approachability: round1(mean(rests, 1)),
    });
    totalAvg += activities;
    totalRate += rate(responses.length, Number(s['sent_to']));
  }
  let detractorPct = 0;
  if (all.length) {
    const latest = await responsesOf(all[0]!['id']);
    const low = latest.filter((r) => avg([...list<number>(r['months']), ...list<number>(r['rest'])]) <= 5).length;
    detractorPct = latest.length ? Math.round((low * 100) / latest.length) : 0;
  }
  return {
    latestQuarter: all[0]?.['quarter'] ?? '', latestQuarterAvg: quarterOnQuarter[0]?.activities ?? 0,
    avgAcrossQuarters: round1(quarterOnQuarter.length ? totalAvg / quarterOnQuarter.length : 0),
    avgResponseRate: round1(quarterOnQuarter.length ? totalRate / quarterOnQuarter.length : 0), detractorPct, quarterOnQuarter,
  };
}
