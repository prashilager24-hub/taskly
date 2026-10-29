import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { assessorsOf } from '../access/hierarchy';
import { addDays, addMonths, cycleWindows, quarterSlots, splitHike, todayIST, VARIABLE_PCT, type EmployeeLevel } from './appraisal.calc';
import { maskCycle, maskTeamRow, type FullCycle, type Money, type PmsQuarter, type RequestField, type RequestReviews, type Status, type TeamRow, type ViewRole } from './appraisal.mask';

type Row = mysql.RowDataPacket;
type Conn = mysql.PoolConnection;
type Db = mysql.Pool | Conn;

const csv = (v: string) => new Set(v.split(',').map((s) => Number(s.trim())).filter(Boolean));
const FINANCE_ROLES = csv(env.APPRAISAL_FINANCE_ROLE_IDS);
const HR_ROLES = csv(env.APPRAISAL_HR_ROLE_IDS);
/** Admins can always act as Finance and HR, so the module works before those roles are named in the env */
export const isFinance = (role: number) => role === 1 || FINANCE_ROLES.has(role);
export const isHr = (role: number) => role === 1 || HR_ROLES.has(role);

const CLOSED = 'Appraisal window is closed';
const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
const D = (col: string, alias: string) => `DATE_FORMAT(${col}, '%Y-%m-%d') AS ${alias}`;

async function tx<T>(fn: (c: Conn) => Promise<T>): Promise<T> {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const out = await fn(c);
    await c.commit();
    return out;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

export async function audit(db: Db, cycleId: number, actorId: number | null, action: string, detail?: unknown) {
  await db.execute('INSERT INTO AppraisalAudit (CycleID, ActorID, Action, Detail) VALUES (?, ?, ?, ?)', [cycleId, actorId, action, detail === undefined ? null : JSON.stringify(detail)]);
}

// ── Loading a cycle ───────────────────────────────────────────────────────────────────────────────

const parseJson = <T,>(v: unknown, fallback: T): T => { try { const x = typeof v === 'string' ? JSON.parse(v) : v; return (x ?? fallback) as T; } catch { return fallback; } };
const numOrNull = (v: unknown) => (v == null || v === '' ? null : Number(v));

/** Part A: the PMS quarterly reviews of the 12 months before the cycle began, oldest first. Nothing is typed in the appraisal. */
async function pmsQuarters(db: Db, userId: number, start: string): Promise<PmsQuarter[]> {
  const [rows] = await db.execute<Row[]>(
    `SELECT quarter, quarter_year, ${D('quarter_start_date', 's')}, ${D('quarter_end_date', 'e')}, target_percent, goal_achievement, utilization_percent, efficiency_percent, efficiency_label,
            system_grade, manager_avg_rating, final_rating, grade, feedback
       FROM quarterlyreview WHERE emp_id = ? AND quarter_end_date <= ? AND quarter_end_date > DATE_SUB(?, INTERVAL 12 MONTH) ORDER BY quarter_end_date`, [userId, start, start]);
  return rows.map((r) => {
    const grade = parseJson<{ finalGradeLabel?: string }[]>(r['grade'], [])[0];
    const feedback = parseJson<{ feedbackCat?: string; feedback?: string }[]>(r['feedback'], []).filter((f) => f.feedback && f.feedback.trim()).map((f) => ({ category: f.feedbackCat ?? '', text: f.feedback!.trim() }));
    const by = (cats: string[]) => feedback.filter((f) => cats.includes(f.category)).map((f) => f.text).join('\n');
    return {
      quarter: r['quarter'], year: Number(r['quarter_year']), start: r['s'], end: r['e'],
      comments: by(['Meets Expectations', '']), achievements: by(['Exceeds Expectations']), failures: by(['Needs Improvement']),
      targetPercent: numOrNull(r['target_percent']), goalAchievement: numOrNull(r['goal_achievement']), utilizationPercent: numOrNull(r['utilization_percent']), efficiencyPercent: numOrNull(r['efficiency_percent']),
      efficiencyLabel: r['efficiency_label'] ?? '', systemGrade: numOrNull(r['system_grade']), managerAvgRating: numOrNull(r['manager_avg_rating']), finalRating: numOrNull(r['final_rating']), gradeLabel: grade?.finalGradeLabel ?? '', feedback,
    };
  });
}

function requestReviewsOf(rows: Row[], field: RequestField): RequestReviews {
  const one = (role: 'A1' | 'A2') => rows.find((x) => x['Field'] === field && x['ReviewerRole'] === role);
  const a1 = one('A1');
  const a2 = one('A2');
  return { A1: a1 ? { comment: a1['Comment'] ?? '' } : null, A2: a2 ? { comment: a2['Comment'] ?? '', decision: a2['Decision'] ?? null } : null };
}

const moneyOf = (r: Row): Money => ({ annual: Number(r['AnnualAmount']), fixed: Number(r['FixedAmount']), variable: Number(r['VariableAmount']), variablePct: Number(r['VariablePct']), variablePerHalfYear: Number(r['VariableAmount']) / 2 });

export async function loadFull(cycleId: number, db: Db = pool): Promise<FullCycle | null> {
  const [cs] = await db.execute<Row[]>(
    `SELECT c.*, ${D('c.CycleStartDate', 'Start')}, ${D('c.EmployeeWindowEnd', 'EmpEnd')}, ${D('c.AssessorWindowEnd', 'AssEnd')}, ${D('c.PostponedUntil', 'PostUntil')}, ${D('GREATEST(c.CycleStartDate, DATE(c.CreatedAt))', 'PmsRef')},
            u.UserName, a1.UserName AS A1Name, a2.UserName AS A2Name
       FROM AppraisalCycle c
       JOIN Users u ON u.UserID = c.UserID
       LEFT JOIN Users a1 ON a1.UserID = c.Assessor1UserID
       LEFT JOIN Users a2 ON a2.UserID = c.Assessor2UserID
      WHERE c.CycleID = ?`, [cycleId]);
  const c = cs[0];
  if (!c) return null;
  const [qs] = await db.execute<Row[]>('SELECT * FROM AppraisalQuarter WHERE CycleID = ? ORDER BY Quarter', [cycleId]);
  const [qr] = await db.execute<Row[]>('SELECT * FROM AppraisalQuarterReview WHERE CycleID = ?', [cycleId]);
  const [rv] = await db.execute<Row[]>('SELECT * FROM AppraisalReview WHERE CycleID = ?', [cycleId]);
  const [hk] = await db.execute<Row[]>('SELECT * FROM AppraisalHike WHERE CycleID = ?', [cycleId]);
  const [rq] = await db.execute<Row[]>('SELECT * FROM AppraisalRequest WHERE CycleID = ?', [cycleId]);
  const [rs] = await db.execute<Row[]>('SELECT * FROM AppraisalResponse WHERE CycleID = ?', [cycleId]);
  const [rr] = await db.execute<Row[]>('SELECT * FROM AppraisalRequestReview WHERE CycleID = ?', [cycleId]);
  const pms = await pmsQuarters(db, c['UserID'] as number, c['PmsRef'] as string);

  const status = c['Status'] as Status;
  const review = (role: string) => rv.find((r) => r['ReviewerRole'] === role);
  const hike = (kind: string, by: string) => { const h = hk.find((x) => x['Kind'] === kind && x['ByRole'] === by); return h ? moneyOf(h) : null; };
  const rating = (q: number, role: 'A1' | 'A2') => { const r = qr.find((x) => x['Quarter'] === q && x['ReviewerRole'] === role); return r ? { finalRating: r['FinalRating'] == null ? null : Number(r['FinalRating']), comments: (r['Comments'] as string) ?? '' } : null; };
  const assessor = (role: 'A1' | 'A2') => { const r = review(role); return r ? { overallRating: r['OverallRating'] == null ? null : Number(r['OverallRating']), comment: (r['Comment'] as string) ?? '', managerFeedback: (r['ManagerFeedback'] as string) ?? '', submittedAt: iso(r['SubmittedAt']) } : null; };
  const self = review('SELF');
  const resp = rs[0];
  const req = rq[0];

  return {
    cycle: {
      id: c['CycleID'], userId: c['UserID'], employeeName: c['UserName'], year: c['CycleYear'], start: c['Start'], employeeWindowEnd: c['EmpEnd'], assessorWindowEnd: c['AssEnd'],
      status, level: c['EmployeeLevel'], variablePct: c['VariablePct'], postponedUntil: c['PostUntil'] ?? null, currentAnnualCtc: c['CurrentAnnualCtc'] == null ? null : Number(c['CurrentAnnualCtc']),
      assessor1: c['Assessor1UserID'] ? { userId: c['Assessor1UserID'], name: c['A1Name'] } : null,
      assessor2: c['Assessor2UserID'] ? { userId: c['Assessor2UserID'], name: c['A2Name'] } : null,
      late: status !== 'EMPLOYEE_OPEN' && !self?.['SubmittedAt'],
    },
    self: self ? { answers: self['AnswersJson'] ? (typeof self['AnswersJson'] === 'string' ? JSON.parse(self['AnswersJson']) : self['AnswersJson']) : {}, submittedAt: iso(self['SubmittedAt']) } : null,
    quarters: [1, 2, 3, 4].map((n) => {
      const q = qs.find((x) => x['Quarter'] === n);
      return { quarter: n, goals: q?.['Goals'] ?? '', targets: q?.['Targets'] ?? '', comments: q?.['Comments'] ?? '', biggestAchievements: q?.['BiggestAchievements'] ?? '', biggestFailures: q?.['BiggestFailures'] ?? '', ratings: { A1: rating(n, 'A1'), A2: rating(n, 'A2') } };
    }),
    pms,
    slots: quarterSlots(c['PmsRef'] as string),
    requestReviews: {
      DESIGNATION: requestReviewsOf(rr, 'DESIGNATION'),
      TEAM: requestReviewsOf(rr, 'TEAM'),
    },
    request: req ? { newDesignation: req['NewDesignation'] ?? '', designationComment: req['DesignationComment'] ?? '', newTeam: req['NewTeam'] ?? '', teamComment: req['TeamComment'] ?? '' } : null,
    expected: hike('EXPECTED', 'EMPLOYEE'),
    target: hike('TARGET', 'EMPLOYEE'),
    minimal: { A1: hike('MINIMAL', 'A1'), A2: hike('MINIMAL', 'A2') },
    approved: hike('APPROVED', 'FINANCE'),
    assessors: { A1: assessor('A1'), A2: assessor('A2') },
    financeComment: (review('FINANCE')?.['Comment'] as string) ?? null,
    // an old decision stays in the audit trail; the cycle shows only the decision that stands
    response: resp && (status === 'ACCEPTED' || status === 'POSTPONED')
      ? { decision: resp['Decision'], postponeMonths: resp['PostponeMonths'] ?? null, reason: resp['Reason'] ?? '', expectations: resp['Expectations'] ?? '', comment: resp['Comment'] ?? '', hrStatus: resp['HrStatus'] ?? null, hrComment: resp['HrComment'] ?? '', decidedAt: iso(resp['DecidedAt']) ?? '' }
      : null,
  };
}

// ── Who the caller is in a cycle, and what they can do now ────────────────────────────────────────

export function roleIn(full: FullCycle, userId: number, appRole: number): ViewRole | null {
  const c = full.cycle;
  if (c.userId === userId) return 'EMPLOYEE'; // your own cycle is always viewed as the employee, whatever else you are
  if (c.assessor1?.userId === userId) return 'A1';
  if (c.assessor2?.userId === userId) return 'A2';
  if (isFinance(appRole)) return 'FINANCE';
  if (isHr(appRole)) return 'HR';
  return null;
}

/**
 * Who gives the final approval of a hike: for an Associate / FL it is their EL (Assessor 2). For an EL it is Finance,
 * who checks it against the budget. Admins can always step in.
 */
export const canApproveHike = (level: EmployeeLevel, viewRole: ViewRole, appRole: number) =>
  appRole === 1 || (level === 'HEAD_EL' ? isFinance(appRole) : viewRole === 'A2');

/** Changes the employee asked for when accepting that the EL has not decided yet */
export const pendingRequests = (f: FullCycle): RequestField[] =>
  ([['DESIGNATION', f.request?.newDesignation], ['TEAM', f.request?.newTeam]] as const).filter(([field, asked]) => !!asked && !f.requestReviews[field].A2?.decision).map(([field]) => field);

const windowState = (c: FullCycle['cycle'], today: string) => ({
  employeeOpen: c.status === 'EMPLOYEE_OPEN' && today <= c.employeeWindowEnd,
  assessorOpen: c.status === 'ASSESSOR_OPEN' && today >= addDays(c.start, 15) && today <= c.assessorWindowEnd,
});

function abilities(full: FullCycle, role: ViewRole, appRole: number, today: string) {
  const w = windowState(full.cycle, today);
  return {
    selfReview: role === 'EMPLOYEE' && w.employeeOpen,
    assessorReview: (role === 'A1' || role === 'A2') && w.assessorOpen,
    approve: role !== 'EMPLOYEE' && canApproveHike(full.cycle.level, role, appRole) && full.cycle.status === 'FINANCE_REVIEW',
    financeNote: role !== 'EMPLOYEE' && full.cycle.level === 'HEAD_EL' && isFinance(appRole) && full.cycle.status === 'FINANCE_REVIEW',
    respond: role === 'EMPLOYEE' && full.cycle.status === 'OFFERED',
    hrDecision: isHr(appRole) && role !== 'EMPLOYEE' && full.cycle.status === 'POSTPONED' && full.response?.decision === 'REJECT',
    decideRequests: role !== 'EMPLOYEE' && (role === 'A2' || appRole === 1) && full.cycle.status === 'ACCEPTED' && pendingRequests(full).length > 0,
  };
}

function shaped(full: FullCycle, role: ViewRole, appRole: number) {
  const today = todayIST();
  return { ...maskCycle(full, role), can: abilities(full, role, appRole, today), today };
}

export async function myCycle(userId: number, appRole: number) {
  const [rows] = await pool.execute<Row[]>('SELECT CycleID FROM AppraisalCycle WHERE UserID = ? ORDER BY CycleStartDate DESC, CycleID DESC', [userId]);
  const id = rows[0]?.['CycleID'] as number | undefined;
  if (!id) return null;
  const full = await loadFull(id);
  return full ? shaped(full, 'EMPLOYEE', appRole) : null;
}

export async function cycleFor(cycleId: number, userId: number, appRole: number) {
  const full = await loadFull(cycleId);
  if (!full) throw AppError.notFound('Appraisal not found');
  const role = roleIn(full, userId, appRole);
  if (!role) throw AppError.forbidden('You have no part in this appraisal');
  return shaped(full, role, appRole);
}

// ── Team, budget and HR lists ─────────────────────────────────────────────────────────────────────

export async function team(userId: number, appRole: number, status?: string) {
  const fin = isFinance(appRole);
  const [cs] = await pool.query<Row[]>(
    `SELECT c.CycleID FROM AppraisalCycle c
      WHERE (${fin ? '1 = 1' : '(c.Assessor1UserID = ? OR c.Assessor2UserID = ?)'}) ${status ? 'AND c.Status = ?' : ''} AND c.UserID <> ?
      ORDER BY c.CycleStartDate DESC, c.CycleID DESC LIMIT 300`,
    [...(fin ? [] : [userId, userId]), ...(status ? [status] : []), userId]);
  const rows: TeamRow[] = [];
  for (const r of cs) {
    const f = await loadFull(r['CycleID'] as number);
    if (!f) continue;
    const myRole: TeamRow['myRole'] = f.cycle.assessor1?.userId === userId ? 'A1' : f.cycle.assessor2?.userId === userId ? 'A2' : 'FINANCE';
    rows.push({
      cycleId: f.cycle.id, userId: f.cycle.userId, employeeName: f.cycle.employeeName, level: f.cycle.level, status: f.cycle.status, start: f.cycle.start,
      employeeWindowEnd: f.cycle.employeeWindowEnd, assessorWindowEnd: f.cycle.assessorWindowEnd, late: f.cycle.late,
      selfSubmitted: !!f.self?.submittedAt, a1Submitted: !!f.assessors.A1?.submittedAt, a2Submitted: !!f.assessors.A2?.submittedAt, myRole,
      assessor1Name: f.cycle.assessor1?.name ?? null,
      pmsFinalAvg: f.pms.length ? Math.round((f.pms.reduce((t, q) => t + (q.finalRating ?? 0), 0) / f.pms.length) * 100) / 100 : null, pmsQuarters: f.pms.length,
      asksDesignation: !!f.request?.newDesignation, asksTeam: !!f.request?.newTeam,
      canApprove: f.cycle.status === 'FINANCE_REVIEW' && canApproveHike(f.cycle.level, myRole === 'FINANCE' ? 'FINANCE' : myRole, appRole),
      requestsPending: f.cycle.status === 'ACCEPTED' && pendingRequests(f).length > 0,
      canDecideRequests: f.cycle.status === 'ACCEPTED' && pendingRequests(f).length > 0 && (myRole === 'A2' || appRole === 1),
      expected: f.expected, minimal: f.minimal, approved: f.approved,
    });
  }
  return { items: rows.map(maskTeamRow) };
}

/** Rejected offers waiting for (or past) HR */
export async function hrList() {
  const [rs] = await pool.execute<Row[]>(
    `SELECT c.CycleID FROM AppraisalCycle c JOIN AppraisalResponse r ON r.CycleID = c.CycleID
      WHERE c.Status = 'POSTPONED' AND r.Decision = 'REJECT' ORDER BY FIELD(r.HrStatus, 'PENDING') DESC, r.DecidedAt DESC LIMIT 300`);
  const out: Record<string, unknown>[] = [];
  for (const r of rs) {
    const f = await loadFull(r['CycleID'] as number);
    if (f) out.push({ ...(maskCycle(f, 'HR') as Record<string, unknown>), can: { hrDecision: true } });
  }
  return out;
}

// ── Writing: self review ──────────────────────────────────────────────────────────────────────────

export interface SelfReviewInput {
  answers: Record<string, string>;
  quarters?: { quarter: number; goals?: string; targets?: string; comments?: string; biggestAchievements?: string; biggestFailures?: string }[];
  expectedHike?: number | null; targetHike?: number | null;
  request?: { newDesignation?: string; designationComment?: string; newTeam?: string; teamComment?: string };
  submit: boolean;
}

async function lock(c: Conn, cycleId: number) {
  const [rows] = await c.execute<Row[]>(
    `SELECT CycleID, UserID, Status, EmployeeLevel, Assessor1UserID, Assessor2UserID, ${D('CycleStartDate', 'Start')}, ${D('EmployeeWindowEnd', 'EmpEnd')}, ${D('AssessorWindowEnd', 'AssEnd')}
       FROM AppraisalCycle WHERE CycleID = ? FOR UPDATE`, [cycleId]);
  const r = rows[0];
  if (!r) throw AppError.notFound('Appraisal not found');
  return { id: r['CycleID'] as number, userId: r['UserID'] as number, status: r['Status'] as Status, level: r['EmployeeLevel'] as EmployeeLevel, a1: r['Assessor1UserID'] as number | null, a2: r['Assessor2UserID'] as number | null, start: r['Start'] as string, empEnd: r['EmpEnd'] as string, assEnd: r['AssEnd'] as string };
}

async function putHike(c: Conn, cycleId: number, kind: 'EXPECTED' | 'TARGET' | 'MINIMAL' | 'APPROVED', by: 'EMPLOYEE' | 'A1' | 'A2' | 'FINANCE', amount: number | null | undefined, level: EmployeeLevel, actor: number) {
  if (amount == null) {
    await c.execute('DELETE FROM AppraisalHike WHERE CycleID = ? AND Kind = ? AND ByRole = ?', [cycleId, kind, by]);
    return;
  }
  // the split is always worked out here; the client never sends it
  const s = splitHike(amount, level);
  await c.execute(
    `INSERT INTO AppraisalHike (CycleID, Kind, ByRole, AnnualAmount, FixedAmount, VariableAmount, VariablePct, EnteredBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE AnnualAmount = VALUES(AnnualAmount), FixedAmount = VALUES(FixedAmount), VariableAmount = VALUES(VariableAmount), VariablePct = VALUES(VariablePct), EnteredBy = VALUES(EnteredBy)`,
    [cycleId, kind, by, s.annualAmount, s.fixed, s.variable, s.variablePct, actor]);
}

export async function saveSelfReview(cycleId: number, userId: number, input: SelfReviewInput) {
  await tx(async (c) => {
    const cy = await lock(c, cycleId);
    if (cy.userId !== userId) throw AppError.forbidden('Only the employee can fill the self review');
    const today = todayIST();
    // status and date must both say open
    if (cy.status !== 'EMPLOYEE_OPEN' || today > cy.empEnd) throw AppError.conflict(CLOSED);
    if (input.submit && (input.expectedHike == null || input.targetHike == null)) throw new AppError('Enter your expected and target hike before you submit', 422);

    const [old] = await c.execute<Row[]>("SELECT SubmittedAt FROM AppraisalReview WHERE CycleID = ? AND ReviewerRole = 'SELF'", [cycleId]);
    const submittedAt = input.submit ? new Date() : (old[0]?.['SubmittedAt'] as Date | null) ?? null; // saving a draft later never un-submits
    await c.execute(
      `INSERT INTO AppraisalReview (CycleID, ReviewerRole, AnswersJson, SubmittedAt) VALUES (?, 'SELF', ?, ?)
       ON DUPLICATE KEY UPDATE AnswersJson = VALUES(AnswersJson), SubmittedAt = VALUES(SubmittedAt)`, [cycleId, JSON.stringify(input.answers), submittedAt]);

    for (const q of input.quarters ?? []) {
      await c.execute(
        `INSERT INTO AppraisalQuarter (CycleID, Quarter, Goals, Targets, Comments, BiggestAchievements, BiggestFailures) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE Goals = VALUES(Goals), Targets = VALUES(Targets), Comments = VALUES(Comments), BiggestAchievements = VALUES(BiggestAchievements), BiggestFailures = VALUES(BiggestFailures)`,
        [cycleId, q.quarter, q.goals ?? null, q.targets ?? null, q.comments ?? null, q.biggestAchievements ?? null, q.biggestFailures ?? null]);
    }
    await putHike(c, cycleId, 'EXPECTED', 'EMPLOYEE', input.expectedHike, cy.level, userId);
    await putHike(c, cycleId, 'TARGET', 'EMPLOYEE', input.targetHike, cy.level, userId);
    if (input.request) {
      const r = input.request;
      await c.execute(
        `INSERT INTO AppraisalRequest (CycleID, NewDesignation, DesignationComment, NewTeam, TeamComment) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE NewDesignation = VALUES(NewDesignation), DesignationComment = VALUES(DesignationComment), NewTeam = VALUES(NewTeam), TeamComment = VALUES(TeamComment)`,
        [cycleId, r.newDesignation || null, r.designationComment || null, r.newTeam || null, r.teamComment || null]);
    }
    await audit(c, cycleId, userId, input.submit ? 'SELF_SUBMIT' : 'SELF_DRAFT');
  });
}

// ── Writing: assessors ────────────────────────────────────────────────────────────────────────────

export interface AssessorInput {
  quarters?: { quarter: number; finalRating?: number | null; comments?: string }[];
  overallRating?: number | null; comment?: string; managerFeedback?: string; minimalHike?: number | null; submit: boolean;
  /** The FL comments on each change the employee asked for; the EL also approves or rejects it */
  requests?: { designation?: { comment?: string; decision?: 'APPROVED' | 'REJECTED' | null }; team?: { comment?: string; decision?: 'APPROVED' | 'REJECTED' | null } };
}

export async function saveAssessorReview(cycleId: number, userId: number, input: AssessorInput) {
  await tx(async (c) => {
    const cy = await lock(c, cycleId);
    const role: 'A1' | 'A2' | null = cy.a1 === userId ? 'A1' : cy.a2 === userId ? 'A2' : null;
    if (!role) throw AppError.forbidden('You are not an assessor of this appraisal');
    const today = todayIST();
    if (cy.status !== 'ASSESSOR_OPEN' || today < addDays(cy.start, 15) || today > cy.assEnd) throw AppError.conflict(CLOSED);
    if (input.submit && (input.overallRating == null || input.minimalHike == null)) throw new AppError('Give an overall rating and a minimal hike before you submit', 422);

    for (const q of input.quarters ?? []) {
      await c.execute(
        `INSERT INTO AppraisalQuarterReview (CycleID, Quarter, ReviewerRole, FinalRating, Comments) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE FinalRating = VALUES(FinalRating), Comments = VALUES(Comments)`, [cycleId, q.quarter, role, q.finalRating ?? null, q.comments ?? null]);
    }
    const [old] = await c.execute<Row[]>('SELECT SubmittedAt FROM AppraisalReview WHERE CycleID = ? AND ReviewerRole = ?', [cycleId, role]);
    const submittedAt = input.submit ? new Date() : (old[0]?.['SubmittedAt'] as Date | null) ?? null;
    await c.execute(
      `INSERT INTO AppraisalReview (CycleID, ReviewerRole, OverallRating, Comment, ManagerFeedback, SubmittedAt) VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE OverallRating = VALUES(OverallRating), Comment = VALUES(Comment), ManagerFeedback = VALUES(ManagerFeedback), SubmittedAt = VALUES(SubmittedAt)`,
      // manager feedback belongs to the first assessor; the second assessor's is ignored
      [cycleId, role, input.overallRating ?? null, input.comment ?? null, role === 'A1' ? input.managerFeedback ?? null : null, submittedAt]);
    await putHike(c, cycleId, 'MINIMAL', role, input.minimalHike, cy.level, userId);

    // the employee's requests: only changes that were actually asked for can be commented on or decided
    const [asked] = await c.execute<Row[]>('SELECT NewDesignation, NewTeam FROM AppraisalRequest WHERE CycleID = ?', [cycleId]);
    const wants: Record<RequestField, boolean> = { DESIGNATION: !!asked[0]?.['NewDesignation'], TEAM: !!asked[0]?.['NewTeam'] };
    for (const [field, key] of [['DESIGNATION', 'designation'], ['TEAM', 'team']] as const) {
      const r = input.requests?.[key];
      if (!wants[field]) continue;
      if (input.submit && role === 'A2' && !r?.decision) throw new AppError(`Approve or reject the requested change in ${field === 'DESIGNATION' ? 'designation' : 'team'}`, 422);
      if (!r) continue;
      await c.execute(
        `INSERT INTO AppraisalRequestReview (CycleID, Field, ReviewerRole, Comment, Decision, DecidedBy) VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE Comment = VALUES(Comment), Decision = VALUES(Decision), DecidedBy = VALUES(DecidedBy)`,
        // only the EL decides; the FL's decision, if sent, is ignored
        [cycleId, field, role, r.comment ?? null, role === 'A2' ? r.decision ?? null : null, role === 'A2' ? userId : null]);
    }
    await audit(c, cycleId, userId, input.submit ? `${role}_SUBMIT` : `${role}_DRAFT`);
  });
}

// ── Writing: Finance, the employee's answer, HR ───────────────────────────────────────────────────

export async function approveHike(cycleId: number, userId: number, appRole: number, input: { approvedHike: number; comment?: string }) {
  await tx(async (c) => {
    const cy = await lock(c, cycleId);
    if (cy.userId === userId) throw AppError.forbidden('You cannot approve your own appraisal');
    const viewRole: ViewRole = cy.a2 === userId ? 'A2' : cy.a1 === userId ? 'A1' : 'FINANCE';
    if (!canApproveHike(cy.level, viewRole, appRole)) throw AppError.forbidden(cy.level === 'HEAD_EL' ? "Only Finance approves an EL's hike" : 'Only the EL approves this hike');
    if (cy.status !== 'FINANCE_REVIEW') throw AppError.conflict(CLOSED);
    await putHike(c, cycleId, 'APPROVED', 'FINANCE', input.approvedHike, cy.level, userId);
    await c.execute(
      `INSERT INTO AppraisalReview (CycleID, ReviewerRole, Comment, SubmittedAt) VALUES (?, 'FINANCE', ?, ?)
       ON DUPLICATE KEY UPDATE Comment = VALUES(Comment), SubmittedAt = VALUES(SubmittedAt)`, [cycleId, input.comment ?? null, new Date()]);
    await c.execute("UPDATE AppraisalCycle SET Status = 'OFFERED' WHERE CycleID = ?", [cycleId]);
    await audit(c, cycleId, userId, 'STATUS_CHANGE', { from: 'FINANCE_REVIEW', to: 'OFFERED' });
    await audit(c, cycleId, userId, 'HIKE_SET', { kind: 'APPROVED', annual: input.approvedHike, by: viewRole });
  });
}

/** Finance is not satisfied with an EL's hike against the budget: a note goes to that EL only, the cycle stays with Finance */
export async function financeNote(cycleId: number, userId: number, appRole: number, comment: string) {
  if (!isFinance(appRole)) throw AppError.forbidden('Only Finance can write to the EL about the budget');
  await tx(async (c) => {
    const cy = await lock(c, cycleId);
    if (cy.level !== 'HEAD_EL') throw AppError.badRequest("Finance writes to the EL only about an EL's own hike");
    if (cy.status !== 'FINANCE_REVIEW') throw AppError.conflict(CLOSED);
    await c.execute(
      `INSERT INTO AppraisalReview (CycleID, ReviewerRole, Comment, SubmittedAt) VALUES (?, 'FINANCE', ?, NULL)
       ON DUPLICATE KEY UPDATE Comment = VALUES(Comment), SubmittedAt = NULL`, [cycleId, comment]);
    await audit(c, cycleId, userId, 'FINANCE_NOTE', { comment });
  });
}

export interface ChangeRequest { newDesignation?: string; designationComment?: string; newTeam?: string; teamComment?: string }
export type RespondInput = { decision: 'ACCEPT'; comment?: string; request?: ChangeRequest } | { decision: 'REJECT'; postponeMonths: 3 | 6; reason: string; expectations: string; comment?: string };

export async function respond(cycleId: number, userId: number, input: RespondInput) {
  return tx(async (c) => {
    const cy = await lock(c, cycleId);
    if (cy.userId !== userId) throw AppError.forbidden('Only the employee can answer the offer');
    if (cy.status !== 'OFFERED') throw AppError.conflict('There is no offer to answer');
    const now = new Date();
    if (input.decision === 'ACCEPT') {
      await c.execute(
        `INSERT INTO AppraisalResponse (CycleID, Decision, PostponeMonths, Reason, Expectations, Comment, HrApproverUserID, HrStatus, HrComment, DecidedAt) VALUES (?, 'ACCEPT', NULL, NULL, NULL, ?, NULL, NULL, NULL, ?)
         ON DUPLICATE KEY UPDATE Decision = 'ACCEPT', PostponeMonths = NULL, Reason = NULL, Expectations = NULL, Comment = VALUES(Comment), HrApproverUserID = NULL, HrStatus = NULL, HrComment = NULL, DecidedAt = VALUES(DecidedAt)`,
        [cycleId, input.comment ?? null, now]);
      await c.execute("UPDATE AppraisalCycle SET Status = 'ACCEPTED', PostponedUntil = NULL WHERE CycleID = ?", [cycleId]);
      await audit(c, cycleId, userId, 'STATUS_CHANGE', { from: 'OFFERED', to: 'ACCEPTED' });
      // While accepting, the employee may ask for a new designation and / or team. Those go to the EL for the final decision.
      await c.execute('DELETE FROM AppraisalRequestReview WHERE CycleID = ?', [cycleId]);
      await c.execute('DELETE FROM AppraisalRequest WHERE CycleID = ?', [cycleId]);
      const q = input.request ?? {};
      if (q.newDesignation?.trim() || q.newTeam?.trim()) {
        await c.execute('INSERT INTO AppraisalRequest (CycleID, NewDesignation, DesignationComment, NewTeam, TeamComment) VALUES (?, ?, ?, ?, ?)',
          [cycleId, q.newDesignation?.trim() || null, q.newDesignation?.trim() ? q.designationComment?.trim() || null : null, q.newTeam?.trim() || null, q.newTeam?.trim() ? q.teamComment?.trim() || null : null]);
        await audit(c, cycleId, userId, 'CHANGE_REQUESTED', { designation: q.newDesignation ?? null, team: q.newTeam ?? null });
      }
      return { status: 'ACCEPTED' as const, postponedUntil: null };
    }
    const until = addMonths(todayIST(), input.postponeMonths);
    await c.execute(
      `INSERT INTO AppraisalResponse (CycleID, Decision, PostponeMonths, Reason, Expectations, Comment, HrApproverUserID, HrStatus, HrComment, DecidedAt) VALUES (?, 'REJECT', ?, ?, ?, ?, NULL, 'PENDING', NULL, ?)
       ON DUPLICATE KEY UPDATE Decision = 'REJECT', PostponeMonths = VALUES(PostponeMonths), Reason = VALUES(Reason), Expectations = VALUES(Expectations), Comment = VALUES(Comment), HrApproverUserID = NULL, HrStatus = 'PENDING', HrComment = NULL, DecidedAt = VALUES(DecidedAt)`,
      [cycleId, input.postponeMonths, input.reason, input.expectations, input.comment ?? null, now]);
    await c.execute("UPDATE AppraisalCycle SET Status = 'POSTPONED', PostponedUntil = ? WHERE CycleID = ?", [until, cycleId]);
    await audit(c, cycleId, userId, 'STATUS_CHANGE', { from: 'OFFERED', to: 'POSTPONED', months: input.postponeMonths, until });
    return { status: 'POSTPONED' as const, postponedUntil: until };
  });
}

/** After the employee accepted: the EL gives the final decision on each designation / team change they asked for. A decision is final. */
export async function decideRequests(cycleId: number, userId: number, appRole: number, input: { designation?: { decision: 'APPROVED' | 'REJECTED'; comment?: string }; team?: { decision: 'APPROVED' | 'REJECTED'; comment?: string } }) {
  await tx(async (c) => {
    const cy = await lock(c, cycleId);
    if (cy.userId === userId) throw AppError.forbidden('You cannot decide on your own requests');
    if (cy.a2 !== userId && appRole !== 1) throw AppError.forbidden('Only the EL decides on a designation or team change');
    if (cy.status !== 'ACCEPTED') throw AppError.conflict('Changes are decided after the employee accepts the hike');
    const [asked] = await c.execute<Row[]>('SELECT NewDesignation, NewTeam FROM AppraisalRequest WHERE CycleID = ?', [cycleId]);
    const [done] = await c.execute<Row[]>("SELECT Field FROM AppraisalRequestReview WHERE CycleID = ? AND ReviewerRole = 'A2' AND Decision IS NOT NULL", [cycleId]);
    const decided = new Set(done.map((d) => d['Field'] as string));
    let n = 0;
    for (const [field, key, col] of [['DESIGNATION', 'designation', 'NewDesignation'], ['TEAM', 'team', 'NewTeam']] as const) {
      const d = input[key];
      if (!d) continue;
      if (!asked[0]?.[col]) throw AppError.badRequest(`No ${key} change was asked for`);
      if (decided.has(field)) throw AppError.conflict(`The ${key} change is already decided`);
      await c.execute(
        `INSERT INTO AppraisalRequestReview (CycleID, Field, ReviewerRole, Comment, Decision, DecidedBy) VALUES (?, ?, 'A2', ?, ?, ?)
         ON DUPLICATE KEY UPDATE Comment = VALUES(Comment), Decision = VALUES(Decision), DecidedBy = VALUES(DecidedBy)`, [cycleId, field, d.comment ?? null, d.decision, userId]);
      n++;
    }
    if (!n) throw AppError.badRequest('Choose a decision');
    await audit(c, cycleId, userId, 'CHANGE_DECIDED', input);
  });
}

export async function hrDecision(cycleId: number, userId: number, appRole: number, input: { status: 'APPROVED' | 'RETURNED'; comment?: string }) {
  if (!isHr(appRole)) throw AppError.forbidden('Only HR decides on a postponement');
  await tx(async (c) => {
    const cy = await lock(c, cycleId);
    if (cy.userId === userId) throw AppError.forbidden('You cannot decide on your own appraisal');
    const [rs] = await c.execute<Row[]>('SELECT Decision FROM AppraisalResponse WHERE CycleID = ?', [cycleId]);
    if (cy.status !== 'POSTPONED' || rs[0]?.['Decision'] !== 'REJECT') throw AppError.conflict('There is no postponement to decide on');
    await c.execute('UPDATE AppraisalResponse SET HrStatus = ?, HrComment = ?, HrApproverUserID = ? WHERE CycleID = ?', [input.status, input.comment ?? null, userId, cycleId]);
    await audit(c, cycleId, userId, 'HR_DECISION', { status: input.status });
  });
}

// ── Creating cycles (manual, and from the daily job) ──────────────────────────────────────────────

export interface Appraisee { UserID: number; EmployeeLevel: EmployeeLevel; CurrentAnnualCtc: string | number | null }

/** Inserts one cycle with the snapshot of level, assessors and CTC. Returns null when the person already has a cycle for that year. */
export async function insertCycle(db: Db, u: Appraisee, start: string, actor: number | null): Promise<number | null> {
  const a = await assessorsOf(u.UserID);
  const w = cycleWindows(start);
  const year = Number(start.slice(0, 4));
  const [res] = await db.execute<mysql.ResultSetHeader>(
    `INSERT IGNORE INTO AppraisalCycle (UserID, CycleYear, CycleStartDate, EmployeeWindowEnd, AssessorWindowEnd, Status, EmployeeLevel, VariablePct, Assessor1UserID, Assessor2UserID, CurrentAnnualCtc)
     VALUES (?, ?, ?, ?, ?, 'EMPLOYEE_OPEN', ?, ?, ?, ?, ?)`,
    [u.UserID, year, start, w.employeeWindowEnd, w.assessorWindowEnd, u.EmployeeLevel, VARIABLE_PCT[u.EmployeeLevel], a.accessor1?.userId ?? null, a.accessor2?.userId ?? null, u.CurrentAnnualCtc ?? null]);
  if (!res.affectedRows) return null;
  await audit(db, res.insertId, actor, 'CYCLE_CREATED', { start });
  return res.insertId;
}

export async function createCycle(actor: number, appRole: number, input: { userId: number; cycleStartDate: string }) {
  if (!isFinance(appRole) && !isHr(appRole)) throw AppError.forbidden('Only Finance or HR can create a cycle');
  const [rows] = await pool.execute<Row[]>('SELECT UserID, EmployeeLevel, CurrentAnnualCtc FROM Users WHERE UserID = ? AND IsUserArchived = 0', [input.userId]);
  const u = rows[0];
  if (!u) throw AppError.notFound('User not found');
  if (!u['EmployeeLevel']) throw new AppError('Set this person\'s level first', 422);
  const id = await insertCycle(pool, u as unknown as Appraisee, input.cycleStartDate, actor);
  if (!id) throw AppError.conflict('This person already has an appraisal for that year');
  return { cycleId: id };
}

// ── People setup (joining date, level, CTC) ───────────────────────────────────────────────────────

export async function people(appRole: number) {
  if (!isFinance(appRole) && !isHr(appRole)) throw AppError.forbidden('Only Finance or HR can see this');
  const [rows] = await pool.execute<Row[]>(
    `SELECT u.UserID, u.UserName, u.UserEmail, r.RoleName, ${D('u.DateOfJoining', 'Joined')}, u.EmployeeLevel, u.CurrentAnnualCtc,
            (SELECT COUNT(*) FROM AppraisalCycle c WHERE c.UserID = u.UserID) AS Cycles
       FROM Users u LEFT JOIN AMRole r ON r.RoleID = u.RoleID
      WHERE u.IsUserArchived = 0 AND u.UserStatus = 1 AND u.RoleID <> 1 ORDER BY u.UserName`);
  return rows.map((r) => ({ userId: r['UserID'], name: r['UserName'], email: r['UserEmail'], roleName: r['RoleName'] ?? '', dateOfJoining: r['Joined'] ?? null, level: r['EmployeeLevel'] ?? null, currentAnnualCtc: r['CurrentAnnualCtc'] == null ? null : Number(r['CurrentAnnualCtc']), cycles: Number(r['Cycles']) }));
}

export async function updatePerson(appRole: number, userId: number, input: { dateOfJoining: string | null; level: EmployeeLevel | null; currentAnnualCtc: number | null }) {
  if (!isFinance(appRole) && !isHr(appRole)) throw AppError.forbidden('Only Finance or HR can change this');
  const [res] = await pool.execute<mysql.ResultSetHeader>('UPDATE Users SET DateOfJoining = ?, EmployeeLevel = ?, CurrentAnnualCtc = ? WHERE UserID = ? AND IsUserArchived = 0', [input.dateOfJoining, input.level, input.currentAnnualCtc, userId]);
  if (!res.affectedRows) throw AppError.notFound('User not found');
}

// ── What the sidebar should show right now ────────────────────────────────────────────────────────

const ACTIVE = "(c.Status <> 'ACCEPTED' OR c.UpdatedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY))";

/** The Appraisal menu appears only while there is something for this person in a cycle that is running (or just finished) */
export async function availability(userId: number, appRole: number) {
  const [mine] = await pool.execute<Row[]>(`SELECT c.CycleID, c.Status FROM AppraisalCycle c WHERE c.UserID = ? AND ${ACTIVE} ORDER BY c.CycleStartDate DESC LIMIT 1`, [userId]);
  const [asr] = await pool.execute<Row[]>(
    `SELECT COUNT(*) AS n, SUM(c.Status = 'ASSESSOR_OPEN') AS open FROM AppraisalCycle c WHERE (c.Assessor1UserID = ? OR c.Assessor2UserID = ?) AND c.UserID <> ? AND ${ACTIVE}`, [userId, userId, userId]);
  const fin = isFinance(appRole);
  const hr = isHr(appRole);
  const [bud] = fin ? await pool.execute<Row[]>("SELECT COUNT(*) AS n, SUM(c.Status = 'FINANCE_REVIEW') AS pending FROM AppraisalCycle c WHERE c.EmployeeLevel = 'HEAD_EL' AND c.UserID <> ?", [userId]) : [[]];
  const [leads] = await pool.execute<Row[]>('SELECT 1 FROM Department WHERE ExecutiveLeaderID = ? AND IsDepartmentArchived = 0 LIMIT 1', [userId]);
  const [alloc] = await pool.execute<Row[]>('SELECT 1 FROM AppraisalBudgetAlloc WHERE FlUserID = ? LIMIT 1', [userId]);
  const [hrr] = hr ? await pool.execute<Row[]>("SELECT COUNT(*) AS n, SUM(r.HrStatus = 'PENDING') AS pending FROM AppraisalCycle c JOIN AppraisalResponse r ON r.CycleID = c.CycleID WHERE c.Status = 'POSTPONED' AND r.Decision = 'REJECT' AND c.UserID <> ?", [userId]) : [[]];
  const num = (r: Row | undefined, k: string) => Number(r?.[k] ?? 0);
  const my = { show: mine.length > 0, status: (mine[0]?.['Status'] as Status | undefined) ?? null, cycleId: (mine[0]?.['CycleID'] as number | undefined) ?? null };
  const teamN = { show: num(asr[0], 'n') > 0, open: num(asr[0], 'open') };
  // Budget: Finance sets it, an EL splits it, an FL sees the share they were given. An Associate never sees one.
  const budget = { show: fin || leads.length > 0 || alloc.length > 0, pending: num(bud[0], 'pending') };
  const hrN = { show: hr && num(hrr[0], 'n') > 0, pending: num(hrr[0], 'pending') };
  // Finance and HR also need the setup list to name joining dates before any cycle exists
  const setup = { show: fin || hr };
  return { my, team: teamN, budget, hr: hrN, setup, any: my.show || teamN.show || budget.show || hrN.show || setup.show };
}
