/**
 * People Hub → Variable Pay. Every employee (ELs too) sees, for each finished period of their variable cycle, their
 * PMS final score (the Model X score of the PMS Dashboard: Goal^w × Target^(1−w) with the manager's yearly shift), the
 * payout % it earns under the Policy & Slabs, and the amount (CTC × the level's variable %, per period; or HR's amount).
 *   - Eligible (set up, has a Model X PMS score, score in a paying slab): they appeal for it.
 *   - Not eligible: the page says exactly why (and a word of encouragement for the next cycle).
 * Appeals go straight to the Finance Head (the EL of Strategic Financial Management); no manager approves them.
 * The Finance Head approves (changing an amount needs a reason) or sends it back, and marks it paid; their own
 * appeal is approved by an Admin. Managers only see their team's status (Team Variable Pay).
 */
import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { AppError } from '../../utils/AppError';
import { levelOf } from '../access/hierarchy';
import { hierarchyTeamOf } from '../access/hierarchy';
import { VARIABLE_PCT, type EmployeeLevel } from '../appraisal/appraisal.calc';
import { isFinance, isFinanceHead, pmsQuartersBetween } from '../appraisal/appraisal.service';
import { performanceReport } from '../reports/performanceReport.service';
import type { ReasonCode } from '../pms/pmsScore';

type Row = mysql.RowDataPacket;
export type Cycle = 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUAL';
export type Status = 'WITH_REVIEWER' | 'WITH_FINANCE' | 'APPROVED' | 'PAID' | 'RETURNED';
export interface Slab { from: number; to: number | null; payout: number | null; cap?: number }
export interface Period { key: string; label: string; start: string; end: string; cycle: Cycle }

const n = (v: unknown) => (v == null ? null : Number(v));
const r2 = (v: number) => Math.round(v * 100) / 100;
const pad = (x: number) => String(x).padStart(2, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayBefore = (ymd: string) => { const d = new Date(`${ymd}T00:00:00`); d.setDate(d.getDate() - 1); return iso(d); };
const today = () => iso(new Date());
const PER_YEAR: Record<Cycle, number> = { QUARTERLY: 4, HALF_YEARLY: 2, ANNUAL: 1 };
export const CYCLE_LABEL: Record<Cycle, string> = { QUARTERLY: 'Quarterly', HALF_YEARLY: 'Half-yearly', ANNUAL: 'Annual' };

// ── Periods: quarters follow the calendar (as the PMS quarters); half years and years follow April – March (as the appraisal) ──

export function periodOn(cycle: Cycle, ymd: string): Period {
  const y = Number(ymd.slice(0, 4)), m = Number(ymd.slice(5, 7));
  if (cycle === 'QUARTERLY') {
    const q = Math.ceil(m / 3), m1 = q * 3 - 2, m3 = q * 3;
    return { cycle, key: `${y}-Q${q}`, label: `Q${q} ${y} (${MON[m1 - 1]} – ${MON[m3 - 1]})`, start: `${y}-${pad(m1)}-01`, end: `${y}-${pad(m3)}-${lastDay(y, m3)}` };
  }
  const fy = m >= 4 ? y : y - 1, fyName = `FY ${fy}-${String((fy + 1) % 100).padStart(2, '0')}`;
  if (cycle === 'ANNUAL') return { cycle, key: `FY${fy}`, label: `${fyName} (Apr ${fy} – Mar ${fy + 1})`, start: `${fy}-04-01`, end: `${fy + 1}-03-31` };
  const h1 = m >= 4 && m <= 9;
  return h1
    ? { cycle, key: `FY${fy}-H1`, label: `H1 ${fyName} (Apr – Sep ${fy})`, start: `${fy}-04-01`, end: `${fy}-09-30` }
    : { cycle, key: `FY${fy}-H2`, label: `H2 ${fyName} (Oct ${fy} – Mar ${fy + 1})`, start: `${fy}-10-01`, end: `${fy + 1}-03-31` };
}
/** The period in progress, and the two before it (the ones a request can be sent for) */
export function periodsFor(cycle: Cycle, on = today()) {
  const current = periodOn(cycle, on);
  const last = periodOn(cycle, dayBefore(current.start));
  const before = periodOn(cycle, dayBefore(last.start));
  return { current, sendable: [last, before] };
}

// ── Policy ──
const DEFAULT_SLABS: Slab[] = [{ from: 0, to: 60, payout: 0 }, { from: 60, to: 75, payout: 50 }, { from: 75, to: 90, payout: 80 }, { from: 90, to: 100, payout: 100 }, { from: 100, to: null, payout: null, cap: 120 }];
export async function slabs(): Promise<Slab[]> {
  const [[r]] = await pool.query<Row[]>("SELECT SettingValue FROM AppSetting WHERE SettingKey = 'variablePaySlabs'");
  try { const s = JSON.parse(String(r?.['SettingValue'] ?? '')); if (Array.isArray(s) && s.length) return s; } catch { /* default */ }
  return DEFAULT_SLABS;
}
export function payoutPct(score: number | null, list: Slab[]): number {
  if (score == null) return 0;
  const s = list.find((x) => score >= x.from && (x.to == null || score < x.to));
  if (!s) return 0;
  return s.payout == null ? r2(Math.min(score, s.cap ?? 120)) : s.payout;
}
export async function saveSlabs(list: Slab[]) {
  const sorted = [...list].sort((a, b) => a.from - b.from);
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i]!, next = sorted[i + 1];
    if (s.to != null && s.to <= s.from) throw AppError.badRequest(`Slab from ${s.from}%: "to" must be above "from"`);
    if (next && s.to !== next.from) throw AppError.badRequest(`Slabs must follow on: ${s.from}–${s.to ?? '…'}% then ${next.from}%`);
    if (!next && s.to != null) throw AppError.badRequest('The last slab must have no upper end');
  }
  if (sorted[0]?.from !== 0) throw AppError.badRequest('The first slab must start at 0%');
  const json = JSON.stringify(sorted.map((s) => ({ from: s.from, to: s.to, payout: s.payout, ...(s.payout == null ? { cap: s.cap ?? 120 } : {}) })));
  if (json.length > 255) throw AppError.badRequest('Too many slabs');
  await pool.query("INSERT INTO AppSetting (SettingKey, SettingValue) VALUES ('variablePaySlabs', ?) ON DUPLICATE KEY UPDATE SettingValue = VALUES(SettingValue)", [json]);
  return sorted;
}

// ── A person's variable pay set-up ──
interface Person { userId: number; name: string; cycle: Cycle; cycleSet: boolean; level: EmployeeLevel; levelPct: number; ctc: number | null; override: number | null; annual: number | null; source: 'OVERRIDE' | 'CTC' | null; departmentId: number | null; department: string }
async function people(ids: number[] | null): Promise<Map<number, Person>> {
  const [rows] = await pool.query<Row[]>(
    `SELECT u.UserID, u.UserName, u.RoleID, u.EmployeeLevel, u.CurrentAnnualCtc, u.VariableCycle, t.AnnualVariable,
            (SELECT du.DepartmentID FROM DepartmentUser du WHERE du.UserID = u.UserID ORDER BY du.DepartmentID LIMIT 1) AS DeptID
     FROM Users u LEFT JOIN VariablePayTarget t ON t.UserID = u.UserID
     WHERE u.IsUserArchived = 0 AND u.UserStatus = 1 ${ids ? 'AND u.UserID IN (?)' : ''}`, ids ? [ids.length ? ids : [0]] : []);
  const [depts] = await pool.query<Row[]>('SELECT d.DepartmentID, d.DepartmentName, p.PrimaryDepartmentName FROM Department d LEFT JOIN PrimaryDepartment p ON p.PrimaryDepartmentId = d.PrimaryDepartmentId');
  const dn = new Map(depts.map((d) => [Number(d['DepartmentID']), d['PrimaryDepartmentName'] ? `${d['PrimaryDepartmentName']} · ${d['DepartmentName']}` : String(d['DepartmentName'])]));
  const out = new Map<number, Person>();
  for (const u of rows) {
    const level: EmployeeLevel = (u['EmployeeLevel'] as EmployeeLevel | null) ?? ({ el: 'HEAD_EL', fl: 'MANAGER' } as Record<string, EmployeeLevel>)[levelOf(Number(u['RoleID']))] ?? 'ASSOCIATE';
    const levelPct = VARIABLE_PCT[level];
    const ctc = n(u['CurrentAnnualCtc']), override = n(u['AnnualVariable']);
    // variable pay is worked out and paid each half year (April – September, October – March) for everyone
    const cycleSet = true;
    const annual = override ?? (ctc ? Math.round((ctc * levelPct) / 100) : null);
    const dept = n(u['DeptID']);
    out.set(Number(u['UserID']), {
      userId: Number(u['UserID']), name: String(u['UserName']), cycle: 'HALF_YEARLY', cycleSet, level, levelPct, ctc, override, annual,
      source: override != null ? 'OVERRIDE' : ctc ? 'CTC' : null, departmentId: dept, department: dept ? dn.get(dept) ?? `Department ${dept}` : 'No department',
    });
  }
  return out;
}
const personOf = async (userId: number) => { const p = (await people([userId])).get(userId); if (!p) throw AppError.notFound('User not found or inactive'); return p; };

/** The PMS score for one person and period, worked out like the PMS Dashboard */
/** The PMS score for one person and period: the PMS Dashboard's Model X score (figures in %) */
async function scoreOf(userId: number, period: Period) {
  const rep = await performanceReport({ from: period.start, to: period.end, grain: 'quarter', userId, excludeZero: false }, null);
  const m = rep.pms;
  const res = m.person?.result;
  return {
    goalPct: m.goalPct, targetPct: m.targetPct, goalWeight: res?.goalWeight != null ? Math.round(res.goalWeight * 100) : 0, shift: res?.managerShift ?? 0,
    score: m.score, reasonCode: (res?.reasonCode ?? 'NO_DATA') as ReasonCode, goalEntries: m.goalEntries, targetEntries: m.targetEntries,
  };
}

/** Everything a period's payout is worked out from */
async function quote(p: Person, period: Period) {
  const s = await scoreOf(p.userId, period);
  const list = await slabs();
  const slabPct = payoutPct(s.score, list);
  const targetAmount = p.annual == null ? null : Math.round(p.annual / PER_YEAR[period.cycle]);
  return { ...s, slabPct, targetAmount, computedAmount: targetAmount == null ? null : Math.round((targetAmount * slabPct) / 100) };
}

// ── Requests ──
export interface Review { step: string; action: string; amount: number | null; comment: string; at: string; by: { userId: number; name: string } | null }
async function load(where: string, params: unknown[]) {
  const [rows] = await pool.query<Row[]>(
    `SELECT r.*, DATE_FORMAT(r.PeriodStart, '%Y-%m-%d') AS PStart, DATE_FORMAT(r.PeriodEnd, '%Y-%m-%d') AS PEnd, DATE_FORMAT(r.PaidOn, '%Y-%m-%d') AS Paid, u.UserName
     FROM VariablePayRequest r JOIN Users u ON u.UserID = r.UserID WHERE ${where} ORDER BY r.PeriodEnd DESC, u.UserName`, params);
  if (!rows.length) return [];
  const ids = rows.map((r) => Number(r['RequestID']));
  const [revs] = await pool.query<Row[]>(
    `SELECT v.*, u.UserName FROM VariablePayReview v LEFT JOIN Users u ON u.UserID = v.ActorID WHERE v.RequestID IN (?) ORDER BY v.CreatedAt, v.ReviewID`, [ids]);
  const reviewerIds = [...new Set(rows.flatMap((r) => (typeof r['Reviewers'] === 'string' ? JSON.parse(r['Reviewers']) : r['Reviewers']) as number[]))];
  const [names] = reviewerIds.length ? await pool.query<Row[]>('SELECT UserID, UserName FROM Users WHERE UserID IN (?)', [reviewerIds]) : [[] as Row[]];
  const nameOf = new Map(names.map((x) => [Number(x['UserID']), String(x['UserName'])]));
  const pp = await people([...new Set(rows.map((r) => Number(r['UserID'])))]);
  return rows.map((r) => {
    const reviewers = ((typeof r['Reviewers'] === 'string' ? JSON.parse(r['Reviewers']) : r['Reviewers']) as number[]).map((id, i) => ({ userId: id, name: nameOf.get(id) ?? `User ${id}`, step: `A${i + 1}` }));
    const status = r['Status'] as Status, step = Number(r['StepIndex']);
    const period = periodOn(r['Cycle'] as Cycle, String(r['PStart']));
    return {
      id: Number(r['RequestID']), userId: Number(r['UserID']), name: String(r['UserName']), department: pp.get(Number(r['UserID']))?.department ?? '',
      periodKey: String(r['PeriodKey']), periodLabel: period.label, start: String(r['PStart']), end: String(r['PEnd']), cycle: r['Cycle'] as Cycle,
      goalPct: n(r['GoalPct']), targetPct: n(r['TargetPct']), goalWeight: Number(r['GoalWeight']), score: n(r['Score']), slabPct: Number(r['SlabPct']),
      targetAmount: Number(r['TargetAmount']), computedAmount: Number(r['ComputedAmount']), proposedAmount: Number(r['ProposedAmount']), finalAmount: n(r['FinalAmount']),
      note: String(r['EmployeeNote'] ?? ''), status, stepIndex: step, reviewers,
      waitingOn: status === 'WITH_REVIEWER' ? reviewers[step] ?? null : status === 'WITH_FINANCE' ? { userId: 0, name: 'Finance Head', step: 'FINANCE' } : status === 'RETURNED' ? { userId: Number(r['UserID']), name: String(r['UserName']), step: 'EMPLOYEE' } : null,
      submittedAt: r['SubmittedAt'], paidOn: r['Paid'] ?? null,
      history: revs.filter((v) => Number(v['RequestID']) === Number(r['RequestID'])).map((v): Review => ({
        step: String(v['Step']), action: String(v['Action']), amount: n(v['Amount']), comment: String(v['Comment'] ?? ''), at: v['CreatedAt'], by: v['ActorID'] ? { userId: Number(v['ActorID']), name: String(v['UserName'] ?? '') } : null,
      })),
    };
  });
}
export type RequestView = Awaited<ReturnType<typeof load>>[number];
const one = async (id: number) => { const [r] = await load('r.RequestID = ?', [id]); if (!r) throw AppError.notFound('Request not found'); return r; };

async function log(id: number, actor: number | null, step: string, action: string, amount: number | null, comment: string | null) {
  await pool.execute('INSERT INTO VariablePayReview (RequestID, ActorID, Step, Action, Amount, Comment) VALUES (?, ?, ?, ?, ?, ?)', [id, actor, step, action, amount, comment?.trim() || null]);
}
/** A bell notification for the next person (shown in the Notifications bell, unlike the appraisal's record-only ones) */
async function notify(users: (number | null | undefined)[], title: string, body: string, link: string, actor: number | null) {
  const ids = [...new Set(users.filter((u): u is number => !!u))];
  if (!ids.length) return;
  await pool.execute(
    "INSERT INTO Notification (Title, Body, Level, LinkUrl, Audience, ExpiresAt, IsActive, CreatedBy, CreatedAt, Source, DeliveredAt) VALUES (?, ?, 'info', ?, ?, ?, 1, ?, NOW(), 'VARIABLE_PAY', NOW())",
    [title, body, link, JSON.stringify({ all: false, departments: [], roles: [], users: ids }), new Date(Date.now() + 30 * 86_400_000), actor ?? 1]).catch(() => undefined);
}
const inr = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;

// ── Eligibility for a period: can this person appeal, and if not, why ──
export interface Eligibility { eligible: boolean; reasons: string[]; short: string; minScore: number; gap: number | null }
function eligibilityOf(p: Person, q: Awaited<ReturnType<typeof quote>>, list: Slab[]): Eligibility {
  const minScore = list.filter((s) => s.payout == null || s.payout > 0).map((s) => s.from).sort((a, b) => a - b)[0] ?? 0;
  const reasons: string[] = [];
  if (p.annual == null) reasons.push('Your variable pay is not set up: HR has not added your CTC in Appraisal Setup (or an amount in Variable Pay → Eligibility).');
  if (!q.goalEntries && !q.targetEntries) reasons.push('There are no goal or target entries for you in this period, so there is no PMS score.');
  else if (q.score == null) reasons.push(`Your ${q.goalEntries ? 'target' : 'goal'} results aren't recorded for this period, so a PMS score can't be given (it needs both goal and target results).`);
  else if (q.slabPct <= 0) reasons.push(`Your PMS score is ${q.score?.toFixed(2) ?? '0'}%; variable pay starts at ${minScore}% (see the Variable Pay Policy).`);
  // one short line for the page (no long explanations)
  const short = p.annual == null ? 'Your variable pay is not set up yet; HR adds it.'
    : !q.goalEntries && !q.targetEntries ? 'No goal or target entries in this half year.'
    : q.score == null ? `Your ${q.goalEntries ? 'target' : 'goal'} results are missing for this half year.`
    : q.slabPct <= 0 ? `Your PMS score is ${q.score.toFixed(2)}%; variable pay starts at ${minScore}%.` : '';
  return { eligible: !reasons.length, reasons, short, minScore, gap: q.score != null && q.score < minScore ? r2(minScore - q.score) : null };
}

// ── My Variable Pay ──
export async function mine(userId: number) {
  const p = await personOf(userId);
  const list = await slabs();
  const { current, sendable } = periodsFor(p.cycle);
  const requests = await load('r.UserID = ?', [userId]);
  const byKey = new Map(requests.map((r) => [r.periodKey, r]));
  const periods = [];
  for (const period of sendable) {
    const req = byKey.get(period.key);
    const canSend = !req || req.status === 'RETURNED';
    const q = canSend ? await quote(p, period) : null;
    periods.push({ ...period, state: canSend ? 'OPEN' : 'SENT', request: req ?? null, quote: q, eligibility: q ? eligibilityOf(p, q, list) : null });
  }
  const cq = await quote(p, current);
  const head = await financeHeadRef();
  return {
    person: { cycle: p.cycle, cycleLabel: CYCLE_LABEL[p.cycle], cycleSet: p.cycleSet, level: p.level, levelPct: p.levelPct, annual: p.annual, source: p.source, department: p.department },
    approver: head && head.userId !== userId ? head : { userId: 0, name: 'Admin' },
    slabs: list, levels: VARIABLE_PCT,
    current: { ...current, quote: cq, eligibility: eligibilityOf(p, cq, list) },
    periods,
    requests,
  };
}
/** The calendar quarters of a period, oldest first (a half year has two) */
function quartersIn(period: Period): Period[] {
  const out: Period[] = [];
  for (let q = periodOn('QUARTERLY', period.start); q.start <= period.end; q = periodOn('QUARTERLY', nextDay(q.end))) out.push(q);
  return out;
}
const nextDay = (ymd: string) => { const d = new Date(`${ymd}T00:00:00`); d.setDate(d.getDate() + 1); return iso(d); };

/**
 * What the person sees when they open a half year (the "Appeal for Variable Pay" view, like My Appraisal): each quarter's
 * PMS Quarterly Review and Quarter Highlights (as in the appraisal), and next to it each quarter's PMS Dashboard figures
 * (Goal %, Target %, PMS score) and the half year's calculation against the policy.
 */
export async function myPeriod(userId: number, periodKey: string) {
  const p = await personOf(userId);
  const { current, sendable } = periodsFor(p.cycle);
  const period = [...sendable, current].find((x) => x.key === periodKey);
  if (!period) throw AppError.badRequest('That half year is not open for variable pay');
  const quarters = [];
  for (const q of quartersIn(period)) {
    const s = await scoreOf(userId, q);
    quarters.push({ quarter: q.key.slice(5), year: Number(q.key.slice(0, 4)), start: q.start, end: q.end, goalPct: s.goalPct, targetPct: s.targetPct, score: s.score, goalEntries: s.goalEntries, targetEntries: s.targetEntries });
  }
  const pms = await pmsQuartersBetween(userId, period.start, period.end);
  const [notes] = await pool.query<Row[]>('SELECT Quarter, QuarterYear, BiggestAchievement, BiggestFailure FROM QuarterReflection WHERE UserID = ?', [userId]);
  const slots = quarters.map((q, i) => {
    const note = notes.find((x) => x['Quarter'] === q.quarter && Number(x['QuarterYear']) === q.year);
    return { n: i + 1, quarter: q.quarter, year: q.year, achievement: String(note?.['BiggestAchievement'] ?? ''), failure: String(note?.['BiggestFailure'] ?? '') };
  });
  return { period, quarters, pms, slots };
}

async function financeHeadRef() {
  const [d] = await pool.query<Row[]>(
    `SELECT u.UserID, u.UserName FROM Department d JOIN Users u ON u.UserID = d.ExecutiveLeaderID AND u.IsUserArchived = 0
     WHERE d.DepartmentName = 'Strategic Financial Management' AND d.IsDepartmentArchived = 0 LIMIT 1`);
  return d[0] ? { userId: Number(d[0]['UserID']), name: String(d[0]['UserName']) } : null;
}
async function adminIds(): Promise<number[]> {
  const [r] = await pool.query<Row[]>('SELECT UserID FROM Users WHERE RoleID = 1 AND IsUserArchived = 0 AND UserStatus = 1');
  return r.map((x) => Number(x['UserID']));
}

/** The person appeals for a finished period; it goes straight to the Finance Head (no manager approves it) */
export async function send(userId: number, periodKey: string, note: string | null) {
  const p = await personOf(userId);
  const period = periodsFor(p.cycle).sendable.find((x) => x.key === periodKey);
  if (!period) throw AppError.badRequest('You can appeal only for a finished period of your variable pay cycle');
  const [[existing]] = await pool.query<Row[]>('SELECT RequestID, Status FROM VariablePayRequest WHERE UserID = ? AND PeriodKey = ?', [userId, periodKey]);
  if (existing && existing['Status'] !== 'RETURNED') throw AppError.conflict('You have already appealed for this period');
  const q = await quote(p, period);
  const el = eligibilityOf(p, q, await slabs());
  if (!el.eligible) throw AppError.badRequest(`You are not eligible for this period: ${el.reasons.join(' ')}`);
  const values = [period.start, period.end, period.cycle, p.departmentId, q.goalPct, q.targetPct, q.goalWeight, q.score, q.slabPct, q.targetAmount, q.computedAmount, q.computedAmount, note?.trim() || null, '[]', 'WITH_FINANCE'];
  let id: number;
  if (existing) {
    id = Number(existing['RequestID']);
    await pool.execute(`UPDATE VariablePayRequest SET PeriodStart = ?, PeriodEnd = ?, Cycle = ?, DepartmentID = ?, GoalPct = ?, TargetPct = ?, GoalWeight = ?, Score = ?, SlabPct = ?,
      TargetAmount = ?, ComputedAmount = ?, ProposedAmount = ?, EmployeeNote = ?, Reviewers = ?, Status = ?, StepIndex = 0, ReturnedTo = NULL, FinalAmount = NULL, SubmittedAt = NOW() WHERE RequestID = ?`, [...values, id]);
  } else {
    const [r] = await pool.execute<mysql.ResultSetHeader>(`INSERT INTO VariablePayRequest (PeriodStart, PeriodEnd, Cycle, DepartmentID, GoalPct, TargetPct, GoalWeight, Score, SlabPct,
      TargetAmount, ComputedAmount, ProposedAmount, EmployeeNote, Reviewers, Status, StepIndex, SubmittedAt, UserID, PeriodKey) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), ?, ?)`, [...values, userId, periodKey]);
    id = r.insertId;
  }
  await log(id, userId, 'EMPLOYEE', existing ? 'RESENT' : 'SENT', q.computedAmount, note);
  const head = await financeHeadRef();
  const to = head && head.userId !== userId ? [head.userId] : await adminIds();
  await notify(to, 'Variable pay appeal', `${p.name} appealed for variable pay for ${period.label}: PMS score ${q.score ?? '—'}%, ${inr(q.computedAmount!)}.`, '/hub/variable-pay/finance', userId);
  return one(id);
}

// ── Team Variable Pay (managers: status only, read-only) ──
export async function team(actorId: number, role: number) {
  const t = await hierarchyTeamOf(actorId, role); // the Hierarchy decides the team
  const ids = t === 'all' ? [...(await people(null)).keys()].filter((x) => x !== actorId) : [...t];
  if (!ids.length) return { people: [], requests: [] };
  const pp = await people(ids);
  const requests = await load('r.UserID IN (?)', [ids]);
  const rows = [...pp.values()].map((p) => {
    const last = periodsFor(p.cycle).sendable[0]!;
    const mineReqs = requests.filter((r) => r.userId === p.userId);
    const lastReq = mineReqs.find((r) => r.periodKey === last.key) ?? null;
    return {
      userId: p.userId, name: p.name, department: p.department, cycleLabel: CYCLE_LABEL[p.cycle], setUp: p.annual != null,
      lastPeriod: last.label, lastStatus: lastReq ? lastReq.status : 'NOT_APPEALED',
      appealed: mineReqs.reduce((a, r) => a + r.computedAmount, 0),
      paid: mineReqs.filter((r) => r.status === 'PAID').reduce((a, r) => a + (r.finalAmount ?? 0), 0),
      lastScore: lastReq?.score ?? null, lastAmount: lastReq ? lastReq.finalAmount ?? lastReq.computedAmount : null,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return { people: rows, requests };
}

// ── Variable Pay Overview (Finance Head / Admin) ──
export async function canFinance(userId: number, role: number) { return isFinance(role) || (await isFinanceHead(userId)); }

/** Everyone's PMS score for their last finished period: one company report per period (people on the same cycle share it) */
async function lastPeriodScores(staff: Person[]) {
  const groups = new Map<string, { period: Period; ids: number[] }>();
  for (const p of staff) {
    const last = periodsFor(p.cycle).sendable[0]!;
    const g = groups.get(last.key) ?? { period: last, ids: [] };
    g.ids.push(p.userId); groups.set(last.key, g);
  }
  const out = new Map<number, { goalPct: number | null; targetPct: number | null; goalWeight: number; shift: number; score: number | null; reasonCode: ReasonCode; goalEntries: number; targetEntries: number }>();
  for (const { period, ids: group } of groups.values()) {
    const rep = await performanceReport({ from: period.start, to: period.end, grain: 'quarter', excludeZero: false }, new Set(group));
    for (const x of rep.people) {
      out.set(x.userId, {
        goalPct: x.pms.goalPct, targetPct: x.pms.targetPct, goalWeight: x.pms.goalWeight != null ? Math.round(x.pms.goalWeight * 100) : 0, shift: x.pms.shift,
        score: x.pms.score, reasonCode: x.pms.reasonCode, goalEntries: x.goal.entries, targetEntries: x.target.entries,
      });
    }
  }
  return out;
}

/** Which calendar quarter / year a request counts in: the one its period ends in */
const qOf = (end: string) => ({ year: Number(end.slice(0, 4)), q: Math.ceil(Number(end.slice(5, 7)) / 3) });
export async function overview(f: { years: number[]; quarters: number[]; groupBy: 'quarter' | 'year' }) {
  const all = await load('1 = 1', []);
  const years = [...new Set([new Date().getFullYear(), ...all.map((r) => qOf(r.end).year)])].sort((a, b) => b - a);
  const keep = (r: RequestView) => { const { year, q } = qOf(r.end); return (!f.years.length || f.years.includes(year)) && (!f.quarters.length || f.quarters.includes(q)); };
  const requests = all.filter(keep);
  const bucketOf = (r: RequestView) => { const { year, q } = qOf(r.end); return f.groupBy === 'year' ? String(year) : `${year}-Q${q}`; };
  const buckets = new Map<string, { period: string; requests: number; appealed: number; approved: number; paid: number; pending: number }>();
  for (const r of requests) {
    const k = bucketOf(r);
    const b = buckets.get(k) ?? { period: k, requests: 0, appealed: 0, approved: 0, paid: 0, pending: 0 };
    b.requests++; b.appealed += r.computedAmount;
    if (r.status === 'APPROVED' || r.status === 'PAID') b.approved += r.finalAmount ?? 0;
    if (r.status === 'PAID') b.paid += r.finalAmount ?? 0;
    if (r.status === 'WITH_FINANCE' || r.status === 'WITH_REVIEWER') b.pending++;
    buckets.set(k, b);
  }
  // everyone in the company (not Admins), with their last finished period worked out now, appealed or not
  const pp = await people(null);
  const admins = new Set(await adminIds());
  const staff = [...pp.values()].filter((p) => !admins.has(p.userId));
  const scores = await lastPeriodScores(staff);
  const list = await slabs();
  const everyone = staff.map((p) => {
    const last = periodsFor(p.cycle).sendable[0]!;
    const req = all.find((r) => r.userId === p.userId && r.periodKey === last.key);
    const sc = scores.get(p.userId) ?? { goalPct: null, targetPct: null, goalWeight: 0, shift: 0, score: null, reasonCode: 'NO_DATA' as ReasonCode, goalEntries: 0, targetEntries: 0 };
    const slabPct = payoutPct(sc.score, list);
    const targetAmount = p.annual == null ? null : Math.round(p.annual / PER_YEAR[p.cycle]);
    const q = { ...sc, slabPct, targetAmount, computedAmount: targetAmount == null ? null : Math.round((targetAmount * slabPct) / 100) };
    const el = eligibilityOf(p, q, list);
    return {
      userId: p.userId, name: p.name, department: p.department, cycleLabel: CYCLE_LABEL[p.cycle], setUp: p.annual != null, lastPeriod: last.label,
      lastStatus: req ? req.status : 'NOT_APPEALED', score: sc.score, goalPct: sc.goalPct, targetPct: sc.targetPct, slabPct, targetAmount, expected: q.computedAmount,
      eligible: el.eligible, reasons: el.reasons,
    };
  }).sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
  return { years, buckets: [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period)), requests, everyone };
}

const maxAmount = async (r: RequestView) => { const cap = Math.max(100, ...(await slabs()).map((s) => (s.payout == null ? s.cap ?? 120 : s.payout))); return Math.round((r.targetAmount * cap) / 100); };
/** The Finance Head never decides their own variable pay: an Admin does */
async function assertNotOwn(actorId: number, role: number, r: RequestView) {
  if (r.userId === actorId) throw AppError.forbidden('You cannot approve your own variable pay: an Admin does that');
  if (role !== 1 && (await financeHeadRef())?.userId === r.userId) throw AppError.forbidden('The Finance Head’s own variable pay is approved by an Admin');
}

export async function financeApprove(actorId: number, role: number, items: { id: number; amount?: number | null }[], comment: string | null) {
  const done = [];
  for (const it of items) {
    const r = await one(it.id);
    if (r.status !== 'WITH_FINANCE') throw AppError.badRequest(`${r.name}'s appeal is not waiting for approval`);
    await assertNotOwn(actorId, role, r);
    const value = it.amount ?? r.proposedAmount;
    if (value < 0 || value > (await maxAmount(r))) throw AppError.badRequest(`${r.name}: the amount must be between ₹0 and ${inr(await maxAmount(r))}`);
    if (value !== r.proposedAmount && !comment?.trim()) throw AppError.badRequest(`Give a reason for changing ${r.name}'s amount`);
    await pool.execute("UPDATE VariablePayRequest SET Status = 'APPROVED', FinalAmount = ? WHERE RequestID = ?", [value, r.id]);
    await log(r.id, actorId, 'FINANCE', 'APPROVED', value, comment);
    await notify([r.userId], 'Variable pay approved', `Your variable pay for ${r.periodLabel} is approved: ${inr(value)}.`, '/hub/variable-pay/my', actorId);
    done.push(r.id);
  }
  return { approved: done.length };
}

/** Back to the person, with the reason; they can check their entries and appeal again */
export async function financeReturn(actorId: number, role: number, id: number, comment: string) {
  const r = await one(id);
  if (r.status !== 'WITH_FINANCE') throw AppError.badRequest('This appeal is not waiting for approval');
  await assertNotOwn(actorId, role, r);
  if (!comment.trim()) throw AppError.badRequest('Say why you are sending it back');
  await pool.execute("UPDATE VariablePayRequest SET Status = 'RETURNED', ReturnedTo = 'EMPLOYEE' WHERE RequestID = ?", [id]);
  await log(id, actorId, 'FINANCE', 'RETURNED', null, comment);
  await notify([r.userId], 'Variable pay appeal sent back', `Your variable pay appeal for ${r.periodLabel} was sent back: ${comment.trim()}`, '/hub/variable-pay/my', actorId);
  return one(id);
}

export async function markPaid(actorId: number, ids: number[], paidOn: string) {
  let n = 0;
  for (const id of ids) {
    const r = await one(id);
    if (r.status !== 'APPROVED') throw AppError.badRequest(`${r.name}'s appeal is not approved yet`);
    await pool.execute("UPDATE VariablePayRequest SET Status = 'PAID', PaidOn = ? WHERE RequestID = ?", [paidOn, id]);
    await log(id, actorId, 'FINANCE', 'PAID', r.finalAmount, `Paid on ${paidOn}`);
    await notify([r.userId], 'Variable pay paid', `Your variable pay for ${r.periodLabel} (${inr(r.finalAmount ?? 0)}) was paid on ${paidOn}.`, '/hub/variable-pay/my', actorId);
    n++;
  }
  return { paid: n };
}

// ── Eligibility (HR / Admin) ──
export async function eligibility() {
  const pp = await people(null);
  const admins = new Set(await adminIds());
  return [...pp.values()].filter((p) => !admins.has(p.userId)).sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({
    ...p, cycleLabel: CYCLE_LABEL[p.cycle], perPeriod: p.annual == null ? null : Math.round(p.annual / PER_YEAR[p.cycle]),
  }));
}
export async function setEligibility(actorId: number, userId: number, input: { annualVariable?: number | null; note?: string | null; cycle?: Cycle | null }) {
  await personOf(userId);
  if (input.annualVariable !== undefined) {
    if (input.annualVariable == null) await pool.execute('DELETE FROM VariablePayTarget WHERE UserID = ?', [userId]);
    else await pool.execute('INSERT INTO VariablePayTarget (UserID, AnnualVariable, Note, UpdatedBy) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE AnnualVariable = VALUES(AnnualVariable), Note = VALUES(Note), UpdatedBy = VALUES(UpdatedBy)', [userId, input.annualVariable, input.note?.trim() || null, actorId]);
  }
  if (input.cycle !== undefined) await pool.execute('UPDATE Users SET VariableCycle = ? WHERE UserID = ?', [input.cycle, userId]);
  return (await eligibility()).find((p) => p.userId === userId) ?? null;
}
