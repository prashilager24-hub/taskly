import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { assessorsOf, assessorsOfMany, levelOf } from '../access/hierarchy';
import { addMonths, currentCycleStart, cycleMonthOf, cycleWindows, periodOf, quarterSlots, splitHike, todayIST, VARIABLE_PCT, type EmployeeLevel } from './appraisal.calc';
import * as flow from './appraisal.flow';
import { maskCycle, type FullCycle, type Money, type PmsQuarter, type RequestField, type RequestReviews, type Status } from './appraisal.mask';

type Row = mysql.RowDataPacket;
type Conn = mysql.PoolConnection;
type Db = mysql.Pool | Conn;

const csv = (v: string) => new Set(v.split(',').map((s) => Number(s.trim())).filter(Boolean));
const FINANCE_ROLES = csv(env.APPRAISAL_FINANCE_ROLE_IDS);
const HR_ROLES = csv(env.APPRAISAL_HR_ROLE_IDS);
/** Admins can always act as Finance and HR, so the module works before those roles are named in the env */
/** Stands in for the signed-in user's role inside the appraisal module when that user is the Finance Head */
export const FINANCE_HEAD_ROLE = -1;
export const isFinance = (role: number) => role === 1 || role === FINANCE_HEAD_ROLE || FINANCE_ROLES.has(role);

// ── The Finance Head ────────────────────────────────────────────────────────────────────────────────
// The person who gives each EL a budget, approves ELs' hikes and sees every appraisal. Chosen in Appraisal Setup
// (AppSetting financeHeadUserId); until someone chooses, it is the head of the Strategic Financial Management department.
const FINANCE_DEPT = 'Strategic Financial Management';
let headCache: { at: number; id: number | null; source: 'setting' | 'department' | 'none' } | null = null;

async function loadFinanceHead() {
  if (headCache && Date.now() - headCache.at < 30_000) return headCache;
  const [[set]] = await pool.execute<Row[]>("SELECT SettingValue FROM AppSetting WHERE SettingKey = 'financeHeadUserId'") as unknown as [Row[]];
  let id = set ? Number(set['SettingValue']) || null : null;
  let source: 'setting' | 'department' | 'none' = id ? 'setting' : 'none';
  if (!id) {
    const [d] = await pool.execute<Row[]>('SELECT ExecutiveLeaderID FROM Department WHERE DepartmentName = ? AND IsDepartmentArchived = 0 AND ExecutiveLeaderID IS NOT NULL LIMIT 1', [FINANCE_DEPT]);
    id = (d[0]?.['ExecutiveLeaderID'] as number | undefined) ?? null;
    if (id) source = 'department';
  }
  headCache = { at: Date.now(), id, source };
  return headCache;
}

export async function isFinanceHead(userId: number) {
  return (await loadFinanceHead()).id === userId;
}

export async function financeHead() {
  const h = await loadFinanceHead();
  if (!h.id) return { userId: null, name: null, email: null, source: h.source, department: FINANCE_DEPT };
  const [u] = await pool.execute<Row[]>('SELECT UserName, UserEmail FROM Users WHERE UserID = ?', [h.id]);
  return { userId: h.id, name: (u[0]?.['UserName'] as string) ?? null, email: (u[0]?.['UserEmail'] as string) ?? null, source: h.source, department: FINANCE_DEPT };
}

export async function setFinanceHead(appRole: number, userId: number) {
  if (appRole !== 1) throw AppError.forbidden('Only an Admin chooses the Finance Head');
  const [u] = await pool.execute<Row[]>('SELECT 1 FROM Users WHERE UserID = ? AND IsUserArchived = 0 AND UserStatus = 1', [userId]);
  if (!u.length) throw AppError.notFound('User not found');
  await pool.execute("INSERT INTO AppSetting (SettingKey, SettingValue) VALUES ('financeHeadUserId', ?) ON DUPLICATE KEY UPDATE SettingValue = VALUES(SettingValue)", [String(userId)]);
  headCache = null;
  return financeHead();
}
/** Stands in for the signed-in user's role inside the appraisal module when that user works in the HR department */
export const HR_MEMBER_ROLE = -2;
export const isHr = (role: number) => role === 1 || role === HR_MEMBER_ROLE || HR_ROLES.has(role);

/** The HR team: the HR roles named in the env, and everyone in the HR Operations department */
const HR_DEPT = 'HR Operations';
export async function inHrDepartment(userId: number) {
  const [r] = await pool.execute<Row[]>(
    'SELECT 1 FROM DepartmentUser du JOIN Department d ON d.DepartmentID = du.DepartmentID WHERE du.UserID = ? AND d.DepartmentName = ? AND d.IsDepartmentArchived = 0 LIMIT 1', [userId, HR_DEPT]);
  return r.length > 0;
}

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
  return { A1: a1 ? { comment: a1['Comment'] ?? '', recommendation: a1['Recommendation'] ?? null } : null, A2: a2 ? { comment: a2['Comment'] ?? '', decision: a2['Decision'] ?? null } : null };
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

// ── What a person sees ────────────────────────────────────────────────────────────────────────────

/** Date windows on or off (APPRAISAL_TIME_WINDOWS). Off (testing): no dates are checked and everyone can appeal at once. */
export const TIMED = env.APPRAISAL_TIME_WINDOWS;

/** The Finance Head and anyone with a Finance role: told when a department is ready for its budget */
async function financeUsers() {
  const head = (await loadFinanceHead()).id;
  const roles = [...FINANCE_ROLES];
  const [r] = roles.length ? await pool.query<Row[]>('SELECT UserID FROM Users WHERE RoleID IN (?) AND UserStatus = 1 AND IsUserArchived = 0', [roles]) : [[]];
  return [...(head ? [head] : []), ...r.map((x) => x['UserID'] as number)];
}

/** HR: the HR roles and everyone in the HR department. Told when a hike is rejected. */
async function hrUsers() {
  const roles = [...HR_ROLES];
  const [r] = await pool.query<Row[]>(
    `SELECT DISTINCT u.UserID FROM Users u WHERE u.UserStatus = 1 AND u.IsUserArchived = 0 AND (${roles.length ? 'u.RoleID IN (?) OR ' : ''}
       u.UserID IN (SELECT du.UserID FROM DepartmentUser du JOIN Department d ON d.DepartmentID = du.DepartmentID WHERE d.DepartmentName = ?))`,
    roles.length ? [roles, HR_DEPT] : [HR_DEPT]);
  return r.map((x) => x['UserID'] as number);
}

flow.wire({ timed: TIMED, financeUsers, tx, audit });

type Ctx = Awaited<ReturnType<typeof flow.contextOf>>;
export type RequestStage = 'WITH_FL' | 'WITH_EL' | 'APPROVED' | 'NOT_APPROVED';

/**
 * The designation / team changes asked for, and where each stands. An Associate's / Intern's request goes to their FL first
 * (comment and recommendation), then to the EL, who decides. Everyone else's goes straight to the EL.
 */
function requestsOf(full: FullCycle, source: flow.Source | null) {
  return (['DESIGNATION', 'TEAM'] as const).flatMap((field) => {
    const value = field === 'DESIGNATION' ? full.request?.newDesignation : full.request?.newTeam;
    if (!value) return [];
    const rv = full.requestReviews[field];
    const decision = rv.A2?.decision ?? null;
    const stage: RequestStage = decision === 'APPROVED' ? 'APPROVED' : decision === 'REJECTED' ? 'NOT_APPROVED' : source === 'FL_TEAM' && !rv.A1?.recommendation ? 'WITH_FL' : 'WITH_EL';
    return [{
      field, value, why: (field === 'DESIGNATION' ? full.request?.designationComment : full.request?.teamComment) ?? '', stage, decision,
      fl: rv.A1 ? { comment: rv.A1.comment, recommendation: rv.A1.recommendation ?? null } : null, elComment: rv.A2?.comment ?? '',
    }];
  });
}

/** Only an Associate / Intern whose hike was decided for them may reject it; an FL or EL agreed their own */
const mayReject = (src: flow.Source | null) => src === null || src === 'FL_TEAM' || src === 'EL_DIRECT';
const legacyStage = (s: Status): flow.Stage => (s === 'EMPLOYEE_OPEN' ? 'APPEAL_OPEN' : s);

function employeeView(full: FullCycle, ctx: Ctx) {
  const c = full.cycle;
  const src = ctx?.person.source ?? null;
  const out = c.status === 'OFFERED' || c.status === 'ACCEPTED' || c.status === 'POSTPONED';
  return {
    role: 'EMPLOYEE' as const, timed: TIMED, today: todayIST(),
    cycle: { ...c, currentAnnualCtc: c.currentAnnualCtc },
    stage: ctx?.stage ?? legacyStage(c.status), department: ctx?.round.department ?? null,
    route: { source: src, fl: ctx?.fl ?? null, el: ctx?.round.el ?? null },
    can: {
      appeal: c.status === 'EMPLOYEE_OPEN' && (!TIMED || todayIST() <= c.employeeWindowEnd),
      respond: c.status === 'OFFERED', reject: c.status === 'OFFERED' && mayReject(src), ask: src !== 'EL_OWN',
    },
    self: full.self, expected: full.expected, target: full.target, pms: full.pms, slots: full.slots,
    approved: out ? full.approved : null,
    // the person is told the decision on each request, never what the FL or EL wrote about it
    requests: requestsOf(full, src).map(({ field, value, why, stage, decision }) => ({ field, value, why, stage, decision })),
    response: full.response,
  };
}

export async function myCycle(userId: number, _appRole: number) {
  const [rows] = await pool.execute<Row[]>('SELECT CycleID FROM AppraisalCycle WHERE UserID = ? ORDER BY CycleStartDate DESC, CycleID DESC', [userId]);
  const id = (rows[0]?.['CycleID'] as number | undefined) ?? (!TIMED ? (await startForTesting(userId)) ?? undefined : undefined);
  if (!id) return null;
  await syncOpenCycles(true);
  const full = await loadFull(id);
  return full ? employeeView(full, await flow.contextOf(id)) : null;
}

/** One person's appraisal for the people who decide it: their FL, their EL, the Finance Head (and Admins) */
export async function cycleFor(cycleId: number, userId: number, appRole: number) {
  const full = await loadFull(cycleId);
  if (!full) throw AppError.notFound('Appraisal not found');
  const ctx = await flow.contextOf(cycleId);
  if (full.cycle.userId === userId) return employeeView(full, ctx);
  const isEl = ctx?.round.el?.userId === userId;
  const isFl = !!ctx && ctx.person.flUserId === userId;
  const named = full.cycle.assessor1?.userId === userId || full.cycle.assessor2?.userId === userId;
  const fin = isFinance(appRole);
  if (!isEl && !isFl && !named && !fin) throw AppError.forbidden('You have no part in this appraisal');
  const src = ctx?.person.source ?? null;
  const requests = requestsOf(full, src);
  return {
    role: isEl ? 'EL' : isFl ? 'FL' : fin ? 'FINANCE' : 'VIEWER', timed: TIMED, today: todayIST(),
    cycle: { ...full.cycle, currentAnnualCtc: isEl || fin ? full.cycle.currentAnnualCtc : undefined },
    stage: ctx?.stage ?? legacyStage(full.cycle.status), department: ctx?.round.department ?? null,
    route: { source: src, fl: ctx?.fl ?? null, el: ctx?.round.el ?? null },
    self: full.self, expected: full.expected, target: full.target, pms: full.pms, slots: full.slots,
    allocation: ctx?.person.allocation ?? null,
    // the reason behind a hike travels upwards only: the FL who wrote it, the EL and the Finance Head
    reason: isEl || isFl || fin ? ctx?.person.reason ?? '' : undefined,
    approved: full.approved, requests, response: full.response,
    can: {
      forward: (isFl || appRole === 1) && full.cycle.status === 'ACCEPTED' && requests.some((r) => r.stage === 'WITH_FL'),
      decide: (isEl || appRole === 1) && full.cycle.status === 'ACCEPTED' && requests.some((r) => r.stage === 'WITH_EL'),
    },
  };
}

/** Designation / team requests for this person to act on: as the FL (forward) or as the EL (decide), and the ones already decided */
export async function requestsInbox(userId: number, appRole: number) {
  const [rows] = await pool.query<Row[]>(
    `SELECT DISTINCT c.CycleID FROM AppraisalRequest q JOIN AppraisalCycle c ON c.CycleID = q.CycleID
       LEFT JOIN Department d ON d.DepartmentID = c.DepartmentID LEFT JOIN AppraisalAllocation a ON a.CycleID = c.CycleID
      WHERE c.UserID <> ? AND (d.ExecutiveLeaderID = ? OR a.FlUserID = ? OR c.Assessor1UserID = ? OR ? = 1)
      ORDER BY c.CycleID DESC LIMIT 200`, [userId, userId, userId, userId, appRole]);
  const out = [];
  for (const r of rows) {
    const v = await cycleFor(r['CycleID'] as number, userId, appRole).catch(() => null);
    if (!v || !('can' in v) || !('allocation' in v)) continue;
    const mine = v.role === 'EL' || appRole === 1 || (v.role === 'FL' && v.route.source === 'FL_TEAM') ? v.requests : [];
    if (!mine.length) continue;
    out.push({ cycleId: v.cycle.id, name: v.cycle.employeeName, level: v.cycle.level, department: v.department, role: v.role, source: v.route.source, fl: v.route.fl, approved: v.approved, requests: mine, can: v.can });
  }
  return out;
}

/**
 * Testing only (date windows off): anyone who opens My Appraisal without a cycle gets one there and then, so the whole
 * flow can be tried by every user without HR setting them up first. Level comes from HR's setup, else from the role.
 * With windows on this never runs: cycles start from HR's details and the April / October dates.
 */
async function startForTesting(userId: number): Promise<number | null> {
  const [rows] = await pool.execute<Row[]>(
    `SELECT UserID, RoleID, EmployeeLevel, CurrentAnnualCtc, ${D('DateOfJoining', 'Joined')} FROM Users WHERE UserID = ? AND UserStatus = 1 AND IsUserArchived = 0 AND RoleID <> 1`, [userId]);
  const u = rows[0];
  if (!u) return null;
  const level: EmployeeLevel = (u['EmployeeLevel'] as EmployeeLevel | null) ?? ({ el: 'HEAD_EL', fl: 'MANAGER' } as Record<string, EmployeeLevel>)[levelOf(u['RoleID'] as number)] ?? 'ASSOCIATE';
  const today = todayIST();
  const due = u['Joined'] ? currentCycleStart(cycleMonthOf(u['Joined'] as string), today) : null;
  // no joining date yet: the period running today, so the whole department lands in the same round
  const start = due && (u['Joined'] as string) < due ? due : periodOf(today);
  return insertCycle(pool, { UserID: userId, EmployeeLevel: level, CurrentAnnualCtc: u['CurrentAnnualCtc'] as number | null }, start, userId);
}

// ── HR list ───────────────────────────────────────────────────────────────────────────────────────

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
    `SELECT CycleID, UserID, Status, EmployeeLevel, Assessor1UserID, Assessor2UserID, DepartmentID, ${D('PeriodStart', 'Period')}, ${D('CycleStartDate', 'Start')}, ${D('EmployeeWindowEnd', 'EmpEnd')}, ${D('AssessorWindowEnd', 'AssEnd')}
       FROM AppraisalCycle WHERE CycleID = ? FOR UPDATE`, [cycleId]);
  const r = rows[0];
  if (!r) throw AppError.notFound('Appraisal not found');
  return { id: r['CycleID'] as number, userId: r['UserID'] as number, status: r['Status'] as Status, level: r['EmployeeLevel'] as EmployeeLevel, a1: r['Assessor1UserID'] as number | null, a2: r['Assessor2UserID'] as number | null, start: r['Start'] as string, empEnd: r['EmpEnd'] as string, assEnd: r['AssEnd'] as string, departmentId: r['DepartmentID'] as number | null, period: r['Period'] as string | null };
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
  const round = await tx(async (c) => {
    const cy = await lock(c, cycleId);
    if (cy.userId !== userId) throw AppError.forbidden('Only the employee can fill the self review');
    const today = todayIST();
    // status and date must both say open
    if (cy.status !== 'EMPLOYEE_OPEN' || (TIMED && today > cy.empEnd)) throw AppError.conflict(CLOSED);
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
    if (input.submit) {
      await c.execute("UPDATE AppraisalCycle SET Status = 'SUBMITTED' WHERE CycleID = ?", [cycleId]);
      await audit(c, cycleId, userId, 'STATUS_CHANGE', { from: 'EMPLOYEE_OPEN', to: 'SUBMITTED' });
    }
    return { departmentId: cy.departmentId, period: cy.period };
  });
  if (input.submit) await flow.onAppealSubmitted(round.departmentId, round.period, userId);
}

// ── Writing: the employee's answer, change requests, HR ───────────────────────────────────────────

export interface ChangeRequest { newDesignation?: string; designationComment?: string; newTeam?: string; teamComment?: string }
export type RespondInput = { decision: 'ACCEPT'; comment?: string; request?: ChangeRequest } | { decision: 'REJECT'; postponeMonths: 3 | 6; reason: string; expectations: string; comment?: string };

export async function respond(cycleId: number, userId: number, input: RespondInput) {
  const ctx = await flow.contextOf(cycleId);
  const src = ctx?.person.source ?? null;
  const asking = input.decision === 'ACCEPT' && !!(input.request?.newDesignation?.trim() || input.request?.newTeam?.trim());
  if (input.decision === 'REJECT' && !mayReject(src)) throw AppError.forbidden('Your hike was agreed with you, so it can only be accepted');
  if (asking && src === 'EL_OWN') throw AppError.badRequest('A designation or team change for an EL is not asked here');
  const out = await tx(async (c) => {
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
  const name = ctx?.person.name ?? 'Someone';
  if (asking) {
    // an Associate's / Intern's request goes to their FL first; everyone else's straight to the EL
    const toFl = src === 'FL_TEAM' && !!ctx?.person.flUserId;
    const what = [input.request?.newDesignation?.trim() && `Designation: ${input.request.newDesignation.trim()}`, input.request?.newTeam?.trim() && `Team: ${input.request.newTeam.trim()}`].filter(Boolean).join(' · ');
    await flow.notify([toFl ? ctx!.person.flUserId : ctx?.round.el?.userId], `${name} asked for a change`,
      `${what}${toFl ? '. Review it and forward it to your EL.' : '. Approve it or not.'}`, '/appraisal/requests', userId);
  }
  if (out.status === 'POSTPONED') await flow.notify([...(await hrUsers()), ctx?.person.flUserId], `${name} rejected their hike`, `Postponed to ${out.postponedUntil}. HR follows up.`, '/appraisal/hr', userId, 'warning');
  return out;
}

/** The FL's comment and recommendation on an Associate's / Intern's request; it then goes to the EL, who decides */
export async function forwardRequests(cycleId: number, userId: number, appRole: number, input: { comment?: string; recommend: boolean }) {
  const ctx = await flow.contextOf(cycleId);
  const full = await loadFull(cycleId);
  if (!full || !ctx) throw AppError.notFound('Appraisal not found');
  if (ctx.person.source !== 'FL_TEAM') throw AppError.badRequest('This request goes straight to the EL');
  if (ctx.person.flUserId !== userId && appRole !== 1) throw AppError.forbidden("Only this person's FL forwards their request");
  if (full.cycle.status !== 'ACCEPTED') throw AppError.conflict('There is no request to forward');
  const waiting = requestsOf(full, 'FL_TEAM').filter((r) => r.stage === 'WITH_FL');
  if (!waiting.length) throw AppError.conflict('This request has already been forwarded');
  await tx(async (c) => {
    for (const r of waiting) {
      await c.execute(
        `INSERT INTO AppraisalRequestReview (CycleID, Field, ReviewerRole, Comment, Recommendation) VALUES (?, ?, 'A1', ?, ?)
         ON DUPLICATE KEY UPDATE Comment = VALUES(Comment), Recommendation = VALUES(Recommendation)`,
        [cycleId, r.field, input.comment?.trim() || null, input.recommend ? 'SUPPORT' : 'NOT_SUPPORT']);
    }
    await audit(c, cycleId, userId, 'CHANGE_FORWARDED', { recommend: input.recommend });
  });
  await flow.notify([ctx.round.el?.userId], `${ctx.fl?.name ?? 'The FL'} forwarded ${ctx.person.name}'s request`,
    `${waiting.map((r) => `${r.field === 'DESIGNATION' ? 'Designation' : 'Team'}: ${r.value}`).join(' · ')}. ${input.recommend ? 'Recommended.' : 'Not recommended.'}`, '/appraisal/requests', userId);
}

/** After the employee accepted: the EL gives the final decision on each designation / team change they asked for. A decision is final. */
export async function decideRequests(cycleId: number, userId: number, appRole: number, input: { designation?: { decision: 'APPROVED' | 'REJECTED'; comment?: string }; team?: { decision: 'APPROVED' | 'REJECTED'; comment?: string } }) {
  const ctx = await flow.contextOf(cycleId);
  await tx(async (c) => {
    const cy = await lock(c, cycleId);
    if (cy.userId === userId) throw AppError.forbidden('You cannot decide on your own requests');
    const el = ctx?.round.el?.userId ?? cy.a2 ?? cy.a1;
    if (el !== userId && appRole !== 1) throw AppError.forbidden('Only the EL of this department decides on a designation or team change');
    if (cy.status !== 'ACCEPTED') throw AppError.conflict('Changes are decided after the employee accepts the hike');
    if (ctx?.person.source === 'FL_TEAM') {
      const [fw] = await c.execute<Row[]>("SELECT Field FROM AppraisalRequestReview WHERE CycleID = ? AND ReviewerRole = 'A1' AND Recommendation IS NOT NULL", [cycleId]);
      for (const [field, key] of [['DESIGNATION', 'designation'], ['TEAM', 'team']] as const) {
        if (input[key] && !fw.some((f) => f['Field'] === field)) throw AppError.conflict(`The FL has not forwarded the ${key} request yet`);
      }
    }
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
  // the person hears the decision; an approval opens the celebration in My Appraisal
  const [q] = await pool.execute<Row[]>('SELECT c.UserID, r.NewDesignation, r.NewTeam FROM AppraisalCycle c JOIN AppraisalRequest r ON r.CycleID = c.CycleID WHERE c.CycleID = ?', [cycleId]);
  const won = [input.designation?.decision === 'APPROVED' && q[0]?.['NewDesignation'] && `you are now ${q[0]['NewDesignation']}`, input.team?.decision === 'APPROVED' && q[0]?.['NewTeam'] && `you are moving to ${q[0]['NewTeam']}`].filter(Boolean);
  if (q[0]) await flow.notify([q[0]['UserID'] as number], won.length ? `Congratulations, ${won.join(' and ')}!` : 'Your request has been decided', won.length ? 'Open My Appraisal to see it.' : 'Open My Appraisal to see the decision.', '/appraisal', userId, won.length ? 'success' : 'info');
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
/** An EL belongs to the department they lead; everyone else to their first department */
/**
 * The department the person is a member of (as set in Departments). Someone in several takes one they lead first (an EL's
 * own hike sits in their own department's budget), then the first; someone in none falls back to a department they lead.
 */
async function departmentOf(db: Db, userId: number): Promise<number | null> {
  const [d] = await db.execute<Row[]>(
    `SELECT COALESCE((SELECT du.DepartmentID FROM DepartmentUser du JOIN Department d ON d.DepartmentID = du.DepartmentID
                       WHERE du.UserID = ? AND d.IsDepartmentArchived = 0 ORDER BY (d.ExecutiveLeaderID <=> ?) DESC, du.DepartmentID LIMIT 1),
                     (SELECT MIN(DepartmentID) FROM Department WHERE ExecutiveLeaderID = ? AND IsDepartmentArchived = 0)) AS D`, [userId, userId, userId]);
  return (d[0]?.['D'] as number | null) ?? null;
}

let syncing: Promise<void> | null = null;
let syncedAt = 0;

/**
 * Keeps every appraisal nobody has decided yet in line with the records Admin and HR edit: the department (Departments),
 * A1 / A2 (the user record), the level and the CTC (Appraisal Setup). Once the department's budget is set, or a hike is
 * entered for the person, their appraisal stays as it is. Runs before the appraisal lists are read (at most every few seconds).
 */
export function syncOpenCycles(force = false): Promise<void> {
  if (syncing) return syncing;
  if (!force && Date.now() - syncedAt < 5_000) return Promise.resolve();
  syncing = (async () => {
    const [cs] = await pool.query<Row[]>(
      `SELECT c.CycleID, c.UserID, c.DepartmentID, ${D('c.PeriodStart', 'P')}, c.Assessor1UserID, c.Assessor2UserID, c.EmployeeLevel, c.CurrentAnnualCtc,
              u.EmployeeLevel AS ULevel, u.CurrentAnnualCtc AS UCtc
         FROM AppraisalCycle c JOIN Users u ON u.UserID = c.UserID
         LEFT JOIN AppraisalRound r ON r.DepartmentID = c.DepartmentID AND r.PeriodStart = c.PeriodStart
        WHERE c.Status IN ('EMPLOYEE_OPEN', 'SUBMITTED') AND (r.RoundID IS NULL OR r.Budget IS NULL)
          AND NOT EXISTS (SELECT 1 FROM AppraisalAllocation a WHERE a.CycleID = c.CycleID)`);
    if (!cs.length) return;
    const assessors = await assessorsOfMany(cs.map((c) => c['UserID'] as number));
    const moved = new Map<string, [number, string]>();
    for (const c of cs) {
      const id = c['CycleID'] as number;
      const a = assessors.get(c['UserID'] as number);
      const next = {
        DepartmentID: (await departmentOf(pool, c['UserID'] as number)) ?? (c['DepartmentID'] as number | null),
        Assessor1UserID: a ? a.accessor1?.userId ?? null : (c['Assessor1UserID'] as number | null),
        Assessor2UserID: a ? a.accessor2?.userId ?? null : (c['Assessor2UserID'] as number | null),
        EmployeeLevel: (c['ULevel'] as EmployeeLevel | null) ?? (c['EmployeeLevel'] as EmployeeLevel),
        CurrentAnnualCtc: c['UCtc'] != null ? Number(c['UCtc']) : (c['CurrentAnnualCtc'] == null ? null : Number(c['CurrentAnnualCtc'])),
      };
      const before = { ...next, DepartmentID: c['DepartmentID'], Assessor1UserID: c['Assessor1UserID'], Assessor2UserID: c['Assessor2UserID'], EmployeeLevel: c['EmployeeLevel'], CurrentAnnualCtc: c['CurrentAnnualCtc'] == null ? null : Number(c['CurrentAnnualCtc']) };
      const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => next[k] !== before[k]);
      if (!changed.length) continue;
      const pct = VARIABLE_PCT[next.EmployeeLevel];
      await pool.execute('UPDATE AppraisalCycle SET DepartmentID = ?, Assessor1UserID = ?, Assessor2UserID = ?, EmployeeLevel = ?, VariablePct = ?, CurrentAnnualCtc = ? WHERE CycleID = ?',
        [next.DepartmentID, next.Assessor1UserID, next.Assessor2UserID, next.EmployeeLevel, pct, next.CurrentAnnualCtc, id]);
      // the split of any hike already typed follows the level
      if (changed.includes('EmployeeLevel')) await pool.execute('UPDATE AppraisalHike SET VariablePct = ?, VariableAmount = ROUND(AnnualAmount * ? / 100), FixedAmount = AnnualAmount - ROUND(AnnualAmount * ? / 100) WHERE CycleID = ?', [pct, pct, pct, id]);
      await audit(pool, id, null, 'UPDATED_FROM_RECORDS', Object.fromEntries(changed.map((k) => [k, { from: before[k], to: next[k] }])));
      if (changed.includes('DepartmentID')) for (const d of [c['DepartmentID'], next.DepartmentID]) if (d) moved.set(`${d}|${c['P']}`, [d as number, c['P'] as string]);
    }
    // a department someone left or joined may now be complete, or no longer be
    for (const [d, p] of moved.values()) await flow.recheckRound(d, p);
  })().finally(() => { syncing = null; syncedAt = Date.now(); });
  return syncing;
}

export async function insertCycle(db: Db, u: Appraisee, start: string, actor: number | null): Promise<number | null> {
  const a = await assessorsOf(u.UserID);
  const w = cycleWindows(start);
  const year = Number(start.slice(0, 4));
  const [res] = await db.execute<mysql.ResultSetHeader>(
    `INSERT IGNORE INTO AppraisalCycle (UserID, CycleYear, CycleStartDate, EmployeeWindowEnd, AssessorWindowEnd, Status, EmployeeLevel, VariablePct, Assessor1UserID, Assessor2UserID, CurrentAnnualCtc, DepartmentID, PeriodStart)
     VALUES (?, ?, ?, ?, ?, 'EMPLOYEE_OPEN', ?, ?, ?, ?, ?, ?, ?)`,
    [u.UserID, year, start, w.employeeWindowEnd, w.assessorWindowEnd, u.EmployeeLevel, VARIABLE_PCT[u.EmployeeLevel], a.accessor1?.userId ?? null, a.accessor2?.userId ?? null, u.CurrentAnnualCtc ?? null, await departmentOf(db, u.UserID), periodOf(start)]);
  if (!res.affectedRows) return null;
  await audit(db, res.insertId, actor, 'CYCLE_CREATED', { start });
  return res.insertId;
}

/**
 * Starts the person's appraisal for their current April / October cycle, once HR has given them a joining date and a level.
 * They must have joined before that cycle began. With date windows on, a cycle is started only while its employee window
 * (days 1 to 15) is still open; with them off (testing) the latest cycle is started whenever the details are saved.
 * Returns the new cycle's id, or null when there is nothing to start (or it already exists).
 */
export async function ensureCycle(userId: number, actor: number | null, today: string = todayIST()): Promise<number | null> {
  const [rows] = await pool.execute<Row[]>(
    `SELECT UserID, EmployeeLevel, CurrentAnnualCtc, ${D('DateOfJoining', 'Joined')} FROM Users
      WHERE UserID = ? AND UserStatus = 1 AND IsUserArchived = 0 AND RoleID <> 1`, [userId]);
  const u = rows[0];
  if (!u || !u['Joined'] || !u['EmployeeLevel']) return null;
  const start = currentCycleStart(cycleMonthOf(u['Joined'] as string), today);
  if ((u['Joined'] as string) >= start) return null; // joined after this cycle began: their first one is the next
  if (TIMED && today > cycleWindows(start).employeeWindowEnd) return null;
  return insertCycle(pool, u as unknown as Appraisee, start, actor);
}

// ── People setup (HR: joining date, level, CTC; the cycle follows from the joining date) ──────────

export async function people(appRole: number) {
  if (!isHr(appRole)) throw AppError.forbidden('Only HR can see this');
  const [rows] = await pool.execute<Row[]>(
    `SELECT u.UserID, u.UserName, u.UserEmail, u.EmployeeID, r.RoleName, ${D('u.DateOfJoining', 'Joined')}, u.EmployeeLevel, u.CurrentAnnualCtc,
            (SELECT COUNT(*) FROM AppraisalCycle c WHERE c.UserID = u.UserID) AS Cycles,
            (SELECT CONCAT(DATE_FORMAT(c.CycleStartDate, '%Y-%m-%d'), '|', c.Status) FROM AppraisalCycle c WHERE c.UserID = u.UserID ORDER BY c.CycleStartDate DESC, c.CycleID DESC LIMIT 1) AS Latest
       FROM Users u LEFT JOIN AMRole r ON r.RoleID = u.RoleID
      WHERE u.IsUserArchived = 0 AND u.UserStatus = 1 AND u.RoleID <> 1 ORDER BY u.UserName`);
  return rows.map((r) => {
    const [start, status] = r['Latest'] ? String(r['Latest']).split('|') : [null, null];
    return {
      userId: r['UserID'], name: r['UserName'], email: r['UserEmail'], employeeId: r['EmployeeID'] ?? null, roleName: r['RoleName'] ?? '',
      dateOfJoining: r['Joined'] ?? null, level: r['EmployeeLevel'] ?? null, currentAnnualCtc: r['CurrentAnnualCtc'] == null ? null : Number(r['CurrentAnnualCtc']),
      cycleMonth: r['Joined'] ? cycleMonthOf(r['Joined'] as string) : null, cycles: Number(r['Cycles']),
      latestCycle: start ? { start, status: status as Status } : null,
    };
  });
}

export interface PersonInput { dateOfJoining: string | null; level: EmployeeLevel | null; currentAnnualCtc: number | null }

/** Saves one person's details; an appraisal not yet submitted takes the new level and CTC; their cycle starts when it is due */
async function savePerson(userId: number, input: PersonInput, actor: number) {
  const [res] = await pool.execute<mysql.ResultSetHeader>('UPDATE Users SET DateOfJoining = ?, EmployeeLevel = ?, CurrentAnnualCtc = ? WHERE UserID = ? AND IsUserArchived = 0 AND RoleID <> 1', [input.dateOfJoining, input.level, input.currentAnnualCtc, userId]);
  if (!res.affectedRows) throw AppError.notFound('User not found');
  if (input.level) {
    const pct = VARIABLE_PCT[input.level];
    const [open] = await pool.execute<Row[]>("SELECT CycleID FROM AppraisalCycle WHERE UserID = ? AND Status = 'EMPLOYEE_OPEN'", [userId]);
    for (const o of open) {
      await pool.execute('UPDATE AppraisalCycle SET EmployeeLevel = ?, VariablePct = ?, CurrentAnnualCtc = ? WHERE CycleID = ?', [input.level, pct, input.currentAnnualCtc, o['CycleID']]);
      // the split of any hike already typed follows the new level
      await pool.execute('UPDATE AppraisalHike SET VariablePct = ?, VariableAmount = ROUND(AnnualAmount * ? / 100), FixedAmount = AnnualAmount - ROUND(AnnualAmount * ? / 100) WHERE CycleID = ?', [pct, pct, pct, o['CycleID']]);
    }
  }
  return { cycleStarted: await ensureCycle(userId, actor) };
}

export async function updatePerson(actor: number, appRole: number, userId: number, input: PersonInput) {
  if (!isHr(appRole)) throw AppError.forbidden('Only HR can change this');
  return savePerson(userId, input, actor);
}

/** Bulk upload from the template: each row is saved on its own, so one bad row does not stop the others */
export async function bulkUpdatePeople(actor: number, appRole: number, rows: ({ userId: number } & PersonInput)[]) {
  if (!isHr(appRole)) throw AppError.forbidden('Only HR can change this');
  let saved = 0, started = 0;
  const failed: { userId: number; message: string }[] = [];
  for (const r of rows) {
    try { const out = await savePerson(r.userId, r, actor); saved++; if (out.cycleStarted) started++; }
    catch (e) { failed.push({ userId: r.userId, message: e instanceof Error ? e.message : 'Could not save' }); }
  }
  return { saved, started, failed };
}

// ── What the sidebar should show right now ────────────────────────────────────────────────────────

const ACTIVE = "(c.Status <> 'ACCEPTED' OR c.UpdatedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY))";

/** The Appraisal menu appears only while there is something for this person in a cycle that is running (or just finished) */
export async function availability(userId: number, appRole: number) {
  const [mine] = await pool.execute<Row[]>(`SELECT c.CycleID, c.Status FROM AppraisalCycle c WHERE c.UserID = ? AND ${ACTIVE} ORDER BY c.CycleStartDate DESC LIMIT 1`, [userId]);
  const fin = isFinance(appRole);
  const hr = isHr(appRole);
  const num = (r: Row | undefined, k: string) => Number(r?.[k] ?? 0);
  const [ready] = fin ? await pool.execute<Row[]>("SELECT COUNT(*) AS n FROM AppraisalRound WHERE Status = 'READY_FOR_FINANCE'") : [[]];
  const [leads] = await pool.execute<Row[]>('SELECT DepartmentID FROM Department WHERE ExecutiveLeaderID = ? AND IsDepartmentArchived = 0', [userId]);
  const [elTodo] = leads.length ? await pool.query<Row[]>(
    `SELECT (SELECT COUNT(*) FROM AppraisalRound r WHERE r.DepartmentID IN (?) AND r.Status = 'BUDGET_WITH_EL')
          + (SELECT COUNT(*) FROM AppraisalShare s JOIN AppraisalRound r ON r.RoundID = s.RoundID WHERE r.DepartmentID IN (?) AND s.Status = 'SUBMITTED') AS n`,
    [leads.map((d) => d['DepartmentID']), leads.map((d) => d['DepartmentID'])]) : [[]];
  const [shares] = await pool.execute<Row[]>("SELECT COUNT(*) AS n, SUM(Status IN ('SHARE_RECEIVED','DRAFT')) AS todo FROM AppraisalShare WHERE FlUserID = ? AND Status <> 'PLANNED'", [userId]);
  // an FL: someone's reporting manager (assessor 1 of a cycle, or named on a user while testing)
  const [lead] = await pool.execute<Row[]>(
    `SELECT 1 FROM AppraisalCycle WHERE Assessor1UserID = ? AND UserID <> ? ${!TIMED ? 'UNION SELECT 1 FROM Users WHERE IsUserArchived = 0 AND UserStatus = 1 AND ReportingManagerID = ? AND UserID <> ?' : ''} LIMIT 1`,
    !TIMED ? [userId, userId, userId, userId] : [userId, userId]);
  const [hrr] = hr ? await pool.execute<Row[]>("SELECT COUNT(*) AS n, SUM(r.HrStatus = 'PENDING') AS pending FROM AppraisalCycle c JOIN AppraisalResponse r ON r.CycleID = c.CycleID WHERE c.Status = 'POSTPONED' AND r.Decision = 'REJECT' AND c.UserID <> ?", [userId]) : [[]];
  // While testing (no date windows) everyone sees My Appraisal; with windows on, it follows each person's cycle
  const my = { show: mine.length > 0 || (!TIMED && appRole !== 1), status: (mine[0]?.['Status'] as Status | undefined) ?? null, cycleId: (mine[0]?.['CycleID'] as number | undefined) ?? null };
  const departments = { show: fin, pending: num(ready[0], 'n') };
  const split = { show: leads.length > 0, pending: num(elTodo[0], 'n') };
  const allocation = { show: num(shares[0], 'n') > 0 || lead.length > 0, pending: num(shares[0], 'todo') };
  const requests = { show: split.show || allocation.show };
  const hrN = { show: hr && num(hrr[0], 'n') > 0, pending: num(hrr[0], 'pending') };
  // HR keeps each person's joining date, level and CTC, before any cycle exists
  const setup = { show: hr };
  return { my, departments, split, allocation, requests, hr: hrN, setup, any: my.show || departments.show || split.show || allocation.show || hrN.show || setup.show };
}
