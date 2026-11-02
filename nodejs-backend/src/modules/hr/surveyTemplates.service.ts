/**
 * Survey templates: the questions of the Onboarding Experience and Employee Engagement surveys.
 *
 * HR keeps any number of templates of each kind, one of them the default. Sending a survey copies the template's
 * questions into the survey (snapshot), so editing or retiring a template never changes how earlier answers read.
 */
import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { AppError } from '../../utils/AppError';

type Row = mysql.RowDataPacket;

export type TemplateKind = 'ONBOARDING' | 'ENGAGEMENT';
export type QuestionKind = 'RATING' | 'MONTHLY' | 'TEXT';

export interface TemplateQuestion { section: string | null; text: string; short: string | null; kind: QuestionKind }

/** What a survey stores: the template it came from and its questions as they were when sent */
export interface QuestionSnapshot { templateId: number; name: string; questions: TemplateQuestion[] }

export interface TemplateInput { id?: number; kind: TemplateKind; name: string; description?: string | null; questions: TemplateQuestion[] }

const summary = (r: Row) => ({
  id: r['TemplateID'] as number, kind: r['Kind'] as TemplateKind, name: r['Name'] as string, description: (r['Description'] as string | null) ?? '',
  active: !!r['IsActive'], isDefault: !!r['IsDefault'], questionCount: Number(r['questionCount'] ?? 0), updatedAt: r['UpdatedAt'],
});

export async function listTemplates(kind?: TemplateKind, includeInactive = false) {
  const [rows] = await pool.query<Row[]>(
    `SELECT t.*, (SELECT COUNT(*) FROM SurveyTemplateQuestion q WHERE q.TemplateID = t.TemplateID) AS questionCount
     FROM SurveyTemplate t WHERE (? IS NULL OR t.Kind = ?) AND (? OR t.IsActive = 1)
     ORDER BY t.IsDefault DESC, t.Name`, [kind ?? null, kind ?? null, includeInactive ? 1 : 0]);
  return rows.map(summary);
}

async function questionsOf(templateId: number): Promise<TemplateQuestion[]> {
  const [rows] = await pool.query<Row[]>('SELECT Section, Text, ShortLabel, Kind FROM SurveyTemplateQuestion WHERE TemplateID = ? ORDER BY Position', [templateId]);
  return rows.map((q) => ({ section: q['Section'] ?? null, text: q['Text'], short: q['ShortLabel'] ?? null, kind: q['Kind'] }));
}

export async function getTemplate(id: number) {
  const [[t]] = await pool.query<Row[]>('SELECT t.*, 0 AS questionCount FROM SurveyTemplate t WHERE t.TemplateID = ?', [id]);
  if (!t) throw AppError.notFound('Survey template not found');
  const questions = await questionsOf(id);
  return { ...summary(t), questionCount: questions.length, questions };
}

/** Rules for what a template may contain */
function validate(input: TemplateInput) {
  const name = input.name?.trim();
  if (!name) throw AppError.badRequest('Give the template a name');
  if (!input.questions?.length) throw AppError.badRequest('Add at least one question');
  const questions = input.questions.map((q) => ({
    section: input.kind === 'ONBOARDING' ? (q.section?.trim() || null) : null,
    text: q.text?.trim(),
    short: q.short?.trim() || null,
    kind: q.kind,
  }));
  questions.forEach((q, i) => {
    if (!q.text) throw AppError.badRequest(`Question ${i + 1} has no text`);
    if (q.text.length > 500) throw AppError.badRequest(`Question ${i + 1} is longer than 500 characters`);
    if (!['RATING', 'MONTHLY', 'TEXT'].includes(q.kind)) throw AppError.badRequest(`Question ${i + 1} has an unknown type`);
    if (q.kind === 'MONTHLY' && input.kind !== 'ENGAGEMENT') throw AppError.badRequest('Only engagement surveys can have a monthly question');
  });
  if (!questions.some((q) => q.kind === 'RATING' || q.kind === 'MONTHLY')) throw AppError.badRequest('Add at least one rating question');
  if (questions.filter((q) => q.kind === 'MONTHLY').length > 1) throw AppError.badRequest('An engagement survey can have only one monthly question');
  if (questions.filter((q) => q.kind === 'TEXT').length > 1) throw AppError.badRequest('A survey can have only one open (text) question');
  // the open question closes the survey; the monthly question opens it
  const monthly = questions.findIndex((q) => q.kind === 'MONTHLY');
  if (monthly > 0) questions.unshift(...questions.splice(monthly, 1));
  const text = questions.findIndex((q) => q.kind === 'TEXT');
  if (text >= 0 && text !== questions.length - 1) questions.push(...questions.splice(text, 1));
  return { name, description: input.description?.trim().slice(0, 300) || null, questions };
}

export async function saveTemplate(userId: number, input: TemplateInput) {
  const clean = validate(input);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let id = input.id;
    if (id) {
      const [[existing]] = await conn.query<Row[]>('SELECT Kind FROM SurveyTemplate WHERE TemplateID = ? FOR UPDATE', [id]);
      if (!existing) throw AppError.notFound('Survey template not found');
      if (existing['Kind'] !== input.kind) throw AppError.badRequest('A template cannot change its kind');
      await conn.execute('UPDATE SurveyTemplate SET Name = ?, Description = ? WHERE TemplateID = ?', [clean.name, clean.description, id]);
      await conn.execute('DELETE FROM SurveyTemplateQuestion WHERE TemplateID = ?', [id]);
    } else {
      const [[count]] = await conn.query<Row[]>('SELECT COUNT(*) AS n FROM SurveyTemplate WHERE Kind = ?', [input.kind]);
      const [r] = await conn.execute<mysql.ResultSetHeader>(
        'INSERT INTO SurveyTemplate (Kind, Name, Description, IsActive, IsDefault, CreatedBy) VALUES (?, ?, ?, 1, ?, ?)',
        [input.kind, clean.name, clean.description, Number(count?.['n']) === 0 ? 1 : 0, userId]);
      id = r.insertId;
    }
    await conn.query(
      'INSERT INTO SurveyTemplateQuestion (TemplateID, Position, Section, Text, ShortLabel, Kind) VALUES ?',
      [clean.questions.map((q, i) => [id, i + 1, q.section, q.text, q.short, q.kind])]);
    await conn.commit();
    return getTemplate(id!);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function setActive(id: number, active: boolean) {
  const t = await getTemplate(id);
  if (!active && t.isDefault) throw AppError.badRequest('Make another template the default before turning this one off');
  await pool.execute('UPDATE SurveyTemplate SET IsActive = ? WHERE TemplateID = ?', [active ? 1 : 0, id]);
  return getTemplate(id);
}

export async function setDefault(id: number) {
  const t = await getTemplate(id);
  if (!t.active) throw AppError.badRequest('Turn the template on before making it the default');
  await pool.execute('UPDATE SurveyTemplate SET IsDefault = (TemplateID = ?) WHERE Kind = ?', [id, t.kind]);
  return getTemplate(id);
}

/** The questions a new survey of this kind is sent with: the chosen template, or the default one */
export async function snapshotFor(kind: TemplateKind, templateId?: number | null): Promise<QuestionSnapshot> {
  const [[t]] = await pool.query<Row[]>(
    templateId
      ? 'SELECT TemplateID, Name, IsActive, Kind FROM SurveyTemplate WHERE TemplateID = ?'
      : 'SELECT TemplateID, Name, IsActive, Kind FROM SurveyTemplate WHERE Kind = ? AND IsDefault = 1 AND IsActive = 1 LIMIT 1',
    templateId ? [templateId] : [kind]);
  if (!t) throw AppError.badRequest(templateId ? 'Survey template not found' : 'There is no default survey template');
  if (t['Kind'] !== kind) throw AppError.badRequest('That template is for a different kind of survey');
  if (!t['IsActive']) throw AppError.badRequest('That survey template is turned off');
  return { templateId: t['TemplateID'], name: t['Name'], questions: await questionsOf(t['TemplateID']) };
}

export function parseSnapshot(raw: unknown): QuestionSnapshot | null {
  if (typeof raw !== 'string' || !raw) return null;
  try { const v = JSON.parse(raw); return v && Array.isArray(v.questions) ? v : null; } catch { return null; }
}

/** How many answers (ratings, then the monthly question's value counts once) a survey of these questions expects */
export const ratingCount = (s: QuestionSnapshot) => s.questions.filter((q) => q.kind === 'RATING').length;
