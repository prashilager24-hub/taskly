/**
 * Appraisal flow v2: requests go up, money comes down.
 *   1. Everyone (Associate / Intern, FL, EL) appeals: expected hike, target hike, why.
 *   2. When a department is complete, the Finance Head is told; they review it and set its budget with a reason.
 *   3. The EL splits the budget: their own hike (agreed with Management), people reporting to them directly, a share per FL.
 *   4. Each FL turns their share into hikes for the team and their own, with reasons, and sends it to the EL.
 *   5. The EL approves (there is no reject). The hikes go out to the people in My Appraisal.
 * A department's round is per April / October period; each cycle knows its department and period.
 */
import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';
import { AppError } from '../../utils/AppError';
import { MAX_AMOUNT, periodOf, splitHike, todayIST, type EmployeeLevel } from './appraisal.calc';

type Row = mysql.RowDataPacket;
type Conn = mysql.PoolConnection;
type Db = mysql.Pool | Conn;

export type Source = 'EL_OWN' | 'EL_DIRECT' | 'FL_TEAM' | 'FL_OWN';
export type RoundStatus = 'COLLECTING' | 'READY_FOR_FINANCE' | 'BUDGET_WITH_EL' | 'SHARES_WITH_FLS' | 'FINALISED';
export type ShareStatus = 'PLANNED' | 'SHARE_RECEIVED' | 'DRAFT' | 'SUBMITTED' | 'APPROVED';
/** Where one person's appraisal stands, as the statuses list in the blueprint */
export type Stage = 'APPEAL_OPEN' | 'SUBMITTED' | 'BUDGET_REVIEW' | 'IN_ALLOCATION' | 'AWAITING_EL' | 'OFFERED' | 'ACCEPTED' | 'POSTPONED';

const n = (v: unknown) => (v == null ? null : Number(v));
const D = (col: string, alias: string) => `DATE_FORMAT(${col}, '%Y-%m-%d') AS ${alias}`;
const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : v ? String(v) : null);

// ── Shared helpers (set by the service, so this module does not import it back) ──────────────────

let deps: {
  timed: boolean;
  financeUsers: () => Promise<number[]>;
  tx: <T>(fn: (c: Conn) => Promise<T>) => Promise<T>;
  audit: (db: Db, cycleId: number, actorId: number | null, action: string, detail?: unknown) => Promise<void>;
};
export function wire(d: typeof deps) { deps = d; }

/** In-app notification in the bell for these people */
export async function notify(users: (number | null | undefined)[], title: string, body: string, link: string, actor: number | null, level: 'info' | 'success' | 'warning' = 'info') {
  const ids = [...new Set(users.filter((u): u is number => !!u))];
  if (!ids.length) return;
  const expires = new Date(Date.now() + 60 * 86_400_000);
  await pool.execute(
    'INSERT INTO Notification (Title, Body, Level, LinkUrl, Audience, ExpiresAt, IsActive, CreatedBy, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
    [title, body, level, link, JSON.stringify({ all: false, departments: [], roles: [], users: ids }), expires, actor ?? 1, new Date()]);
}

const inr = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;

// ── A department's round ─────────────────────────────────────────────────────────────────────────

export interface RoundPerson {
  cycleId: number; userId: number; name: string; level: EmployeeLevel; status: string; start: string;
  a1: { userId: number; name: string } | null; source: Source; flUserId: number | null;
  expected: number | null; target: number | null; why: string; submittedAt: string | null;
  pmsAvg: number | null; pmsQuarters: number; currentAnnualCtc: number | null;
  allocation: number | null; reason: string; approved: number | null;
}
export interface Share { flUserId: number; name: string; amount: number; elComment: string; status: ShareStatus; justification: string; submittedAt: string | null; approvedAt: string | null; people: number; teamExpected: number; allocated: number }
export interface Round {
  roundId: number | null; departmentId: number; department: string; period: string;
  el: { userId: number; name: string } | null; status: RoundStatus;
  budget: number | null; financeComment: string; budgetSetAt: string | null; elSentAt: string | null;
  people: RoundPerson[]; notStarted: { userId: number; name: string }[];
  fls: { userId: number; name: string }[]; shares: Share[];
  totals: { people: number; submitted: number; expected: number; target: number; allocated: number };
  complete: boolean;
}

async function deptRow(db: Db, departmentId: number) {
  const [d] = await db.execute<Row[]>(
    `SELECT d.DepartmentID, d.DepartmentName, d.ExecutiveLeaderID, e.UserName AS ElName FROM Department d LEFT JOIN Users e ON e.UserID = d.ExecutiveLeaderID
      WHERE d.DepartmentID = ? AND d.IsDepartmentArchived = 0`, [departmentId]);
  if (!d[0]) throw AppError.notFound('Department not found');
  return { id: d[0]['DepartmentID'] as number, name: d[0]['DepartmentName'] as string, el: d[0]['ExecutiveLeaderID'] ? { userId: d[0]['ExecutiveLeaderID'] as number, name: (d[0]['ElName'] as string) ?? '' } : null };
}

async function roundRow(db: Db, departmentId: number, period: string) {
  const [r] = await db.execute<Row[]>(`SELECT *, ${D('PeriodStart', 'P')} FROM AppraisalRound WHERE DepartmentID = ? AND PeriodStart = ?`, [departmentId, period]);
  return r[0] ?? null;
}

/** The round row, created on first use */
export async function ensureRound(db: Db, departmentId: number, period: string): Promise<number> {
  await db.execute('INSERT IGNORE INTO AppraisalRound (DepartmentID, PeriodStart) VALUES (?, ?)', [departmentId, period]);
  return (await roundRow(db, departmentId, period))!['RoundID'] as number;
}

/** Everything about a department's round: who is in it, who decides each person's hike, the budget and the shares */
export async function loadRound(db: Db, departmentId: number, period: string): Promise<Round> {
  const dept = await deptRow(db, departmentId);
  const row = await roundRow(db, departmentId, period);
  const [cs] = await db.query<Row[]>(
    `SELECT c.CycleID, c.UserID, u.UserName, c.EmployeeLevel, c.Status, c.Assessor1UserID, a1.UserName AS A1Name, c.CurrentAnnualCtc, ${D('c.CycleStartDate', 'Start')}
       FROM AppraisalCycle c JOIN Users u ON u.UserID = c.UserID LEFT JOIN Users a1 ON a1.UserID = c.Assessor1UserID
      WHERE c.DepartmentID = ? AND c.PeriodStart = ? ORDER BY u.UserName`, [departmentId, period]);
  const ids = cs.map((c) => c['CycleID'] as number);
  const uids = cs.map((c) => c['UserID'] as number);
  const [hk] = ids.length ? await db.query<Row[]>(`SELECT CycleID, Kind, ByRole, AnnualAmount FROM AppraisalHike WHERE CycleID IN (?)`, [ids]) : [[]];
  const [sf] = ids.length ? await db.query<Row[]>(`SELECT CycleID, AnswersJson, SubmittedAt FROM AppraisalReview WHERE ReviewerRole = 'SELF' AND CycleID IN (?)`, [ids]) : [[]];
  const [al] = ids.length ? await db.query<Row[]>(`SELECT * FROM AppraisalAllocation WHERE CycleID IN (?)`, [ids]) : [[]];
  const [pm] = uids.length ? await db.query<Row[]>(
    `SELECT emp_id, AVG(final_rating) AS avg, COUNT(*) AS cnt FROM quarterlyreview WHERE emp_id IN (?) AND quarter_end_date <= ? AND quarter_end_date > DATE_SUB(?, INTERVAL 12 MONTH) GROUP BY emp_id`,
    [uids, period, period]) : [[]];
  const [sh] = row ? await db.query<Row[]>(`SELECT s.*, u.UserName FROM AppraisalShare s JOIN Users u ON u.UserID = s.FlUserID WHERE s.RoundID = ? ORDER BY u.UserName`, [row['RoundID']]) : [[]];

  const elId = dept.el?.userId ?? null;
  // The FLs of the round: whoever people in it report to (other than the EL), every Manager-level person, and anyone already given a share
  const fls = new Map<number, string>();
  for (const c of cs) if (c['UserID'] !== elId && c['Assessor1UserID'] && c['Assessor1UserID'] !== elId) fls.set(c['Assessor1UserID'] as number, (c['A1Name'] as string) ?? '');
  for (const c of cs) if (c['UserID'] !== elId && c['EmployeeLevel'] === 'MANAGER') fls.set(c['UserID'] as number, c['UserName'] as string);
  for (const s of sh) fls.set(s['FlUserID'] as number, s['UserName'] as string);

  const hike = (id: number, kind: string, by?: string) => n(hk.find((h) => h['CycleID'] === id && h['Kind'] === kind && (!by || h['ByRole'] === by))?.['AnnualAmount']);
  const people: RoundPerson[] = cs.map((c) => {
    const id = c['CycleID'] as number;
    const a = al.find((x) => x['CycleID'] === id);
    const s = sf.find((x) => x['CycleID'] === id);
    const answers = s?.['AnswersJson'] ? (typeof s['AnswersJson'] === 'string' ? JSON.parse(s['AnswersJson']) : s['AnswersJson']) : {};
    const p = pm.find((x) => x['emp_id'] === c['UserID']);
    const uid = c['UserID'] as number;
    const a1 = c['Assessor1UserID'] as number | null;
    // once a hike is entered, who entered it stands even if the reporting lines change later
    const source: Source = (a?.['Source'] as Source | undefined) ?? (uid === elId ? 'EL_OWN' : fls.has(uid) ? 'FL_OWN' : a1 && fls.has(a1) ? 'FL_TEAM' : 'EL_DIRECT');
    const flUserId = a ? (a['FlUserID'] as number | null) : source === 'FL_OWN' ? uid : source === 'FL_TEAM' ? a1 : null;
    return {
      cycleId: id, userId: uid, name: c['UserName'], level: c['EmployeeLevel'], status: c['Status'], start: c['Start'],
      a1: a1 ? { userId: a1, name: (c['A1Name'] as string) ?? '' } : null, source, flUserId,
      expected: hike(id, 'EXPECTED', 'EMPLOYEE'), target: hike(id, 'TARGET', 'EMPLOYEE'), why: (answers?.whyExpectThisSalary as string) ?? '',
      submittedAt: iso(s?.['SubmittedAt']), pmsAvg: p ? Math.round(Number(p['avg']) * 100) / 100 : null, pmsQuarters: p ? Number(p['cnt']) : 0,
      currentAnnualCtc: n(c['CurrentAnnualCtc']), allocation: n(a?.['AnnualAmount']), reason: (a?.['Reason'] as string) ?? '', approved: hike(id, 'APPROVED'),
    };
  });

  // While testing (no date windows), department members who have not opened their appraisal yet still count as not submitted
  let notStarted: { userId: number; name: string }[] = [];
  if (!deps.timed) {
    const [ns] = await db.query<Row[]>(
      `SELECT u.UserID, u.UserName FROM Users u WHERE u.IsUserArchived = 0 AND u.UserStatus = 1 AND u.RoleID <> 1
          AND (u.UserID IN (SELECT UserID FROM DepartmentUser WHERE DepartmentID = ?) OR u.UserID = ?)
          AND NOT EXISTS (SELECT 1 FROM AppraisalCycle c WHERE c.UserID = u.UserID AND c.PeriodStart = ?) ORDER BY u.UserName`, [departmentId, elId ?? 0, period]);
    notStarted = ns.map((r) => ({ userId: r['UserID'] as number, name: r['UserName'] as string }));
  }

  const shares: Share[] = [...fls].map(([flUserId, name]) => {
    const s = sh.find((x) => x['FlUserID'] === flUserId);
    const team = people.filter((p) => p.flUserId === flUserId && p.source === 'FL_TEAM');
    const mine = people.filter((p) => p.flUserId === flUserId);
    return {
      flUserId, name, amount: Number(s?.['Amount'] ?? 0), elComment: (s?.['ElComment'] as string) ?? '', status: (s?.['Status'] as ShareStatus) ?? 'PLANNED',
      justification: (s?.['Justification'] as string) ?? '', submittedAt: iso(s?.['SubmittedAt']), approvedAt: iso(s?.['ApprovedAt']),
      people: mine.length, teamExpected: team.reduce((t, p) => t + (p.expected ?? 0), 0), allocated: mine.reduce((t, p) => t + (p.allocation ?? 0), 0),
    };
  });

  const submitted = people.filter((p) => p.status !== 'EMPLOYEE_OPEN').length;
  const total = people.length + notStarted.length;
  const complete = total > 0 && submitted === total;
  const stored = (row?.['Status'] as RoundStatus | undefined) ?? 'COLLECTING';
  return {
    roundId: (row?.['RoundID'] as number | undefined) ?? null, departmentId, department: dept.name, period, el: dept.el,
    status: stored === 'COLLECTING' && complete ? 'READY_FOR_FINANCE' : stored,
    budget: n(row?.['Budget']), financeComment: (row?.['FinanceComment'] as string) ?? '', budgetSetAt: iso(row?.['BudgetSetAt']), elSentAt: iso(row?.['ElSentAt']),
    people, notStarted, fls: [...fls].map(([userId, name]) => ({ userId, name })), shares,
    totals: { people: total, submitted, expected: people.reduce((t, p) => t + (p.expected ?? 0), 0), target: people.reduce((t, p) => t + (p.target ?? 0), 0), allocated: people.reduce((t, p) => t + (p.allocation ?? 0), 0) },
    complete,
  };
}

/** Where one person stands, worked out from their cycle, their department's round and their FL's proposal */
export function stageOf(p: { status: string; source: Source; flUserId: number | null }, round: Pick<Round, 'status' | 'shares'> | null): Stage {
  if (p.status === 'EMPLOYEE_OPEN') return 'APPEAL_OPEN';
  if (p.status === 'OFFERED') return 'OFFERED';
  if (p.status === 'ACCEPTED') return 'ACCEPTED';
  if (p.status === 'POSTPONED') return 'POSTPONED';
  if (!round || round.status === 'COLLECTING') return 'SUBMITTED';
  if (round.status === 'READY_FOR_FINANCE') return 'BUDGET_REVIEW';
  if ((p.source === 'FL_TEAM' || p.source === 'FL_OWN') && round.shares.find((s) => s.flUserId === p.flUserId)?.status === 'SUBMITTED') return 'AWAITING_EL';
  return 'IN_ALLOCATION';
}

/** A person's place in their round (who decides their hike), or null when the cycle has no department */
export async function contextOf(cycleId: number) {
  const [c] = await pool.execute<Row[]>(`SELECT DepartmentID, ${D('PeriodStart', 'P')} FROM AppraisalCycle WHERE CycleID = ?`, [cycleId]);
  if (!c[0]?.['DepartmentID'] || !c[0]['P']) return null;
  const round = await loadRound(pool, c[0]['DepartmentID'] as number, c[0]['P'] as string);
  const person = round.people.find((p) => p.cycleId === cycleId)!;
  const fl = person.flUserId ? round.fls.find((f) => f.userId === person.flUserId) ?? null : null;
  return { round, person, fl, stage: stageOf(person, round) };
}

// ── Appeals coming in ────────────────────────────────────────────────────────────────────────────

/**
 * After an appeal: when the department is complete, the Finance Head is told (once). `force` is the appeal window closing
 * (date windows on): the department goes to the Finance Head with whoever has not appealed marked as not submitted.
 */
export async function onAppealSubmitted(departmentId: number | null, period: string | null, actor: number | null, force = false) {
  if (!departmentId || !period) return;
  const r = await loadRound(pool, departmentId, period);
  if (!r.totals.people || (!r.complete && !force)) return;
  const id = await ensureRound(pool, departmentId, period);
  const [res] = await pool.execute<mysql.ResultSetHeader>("UPDATE AppraisalRound SET Status = 'READY_FOR_FINANCE', ReadyAt = ? WHERE RoundID = ? AND Status = 'COLLECTING'", [new Date(), id]);
  if (res.affectedRows) {
    await notify(await deps.financeUsers(), `${r.department} is ready for its budget`,
      `${r.complete ? `All ${r.totals.people} appeals are in` : `The appeal window has closed: ${r.totals.submitted} of ${r.totals.people} appeals are in`}. Total expected ${inr(r.totals.expected)}, total target ${inr(r.totals.target)}.`,
      `/appraisal/departments/${departmentId}/${period}`, actor);
  }
}

/** Date windows on: once a period's appeal window (days 1 to 15) has passed, every department of that period goes to the Finance Head */
export async function closeAppealWindows(today: string) {
  const [rows] = await pool.query<Row[]>(
    `SELECT DISTINCT c.DepartmentID, ${D('c.PeriodStart', 'P')} FROM AppraisalCycle c
      LEFT JOIN AppraisalRound r ON r.DepartmentID = c.DepartmentID AND r.PeriodStart = c.PeriodStart
      WHERE c.DepartmentID IS NOT NULL AND DATE_ADD(c.PeriodStart, INTERVAL 14 DAY) < ? AND (r.RoundID IS NULL OR r.Status = 'COLLECTING')`, [today]);
  for (const x of rows) await onAppealSubmitted(x['DepartmentID'] as number, x['P'] as string, null, true);
  return rows.length;
}

// ── Finance Head: all departments, one department, its budget ────────────────────────────────────

export async function periods() {
  const [rows] = await pool.query<Row[]>(`SELECT DISTINCT ${D('PeriodStart', 'P')} FROM AppraisalCycle WHERE PeriodStart IS NOT NULL ORDER BY P DESC LIMIT 8`);
  const list = rows.map((r) => r['P'] as string);
  const now = periodOf(todayIST());
  return [...new Set([now, ...list])].sort().reverse();
}

export async function board(period: string) {
  const [depts] = await pool.query<Row[]>(
    `SELECT d.DepartmentID, d.DepartmentName, d.ExecutiveLeaderID, e.UserName AS ElName FROM Department d LEFT JOIN Users e ON e.UserID = d.ExecutiveLeaderID
      WHERE d.IsDepartmentArchived = 0 AND d.DepartmentStatus = 1 AND d.ExecutiveLeaderID IS NOT NULL ORDER BY d.DepartmentName`);
  const [agg] = await pool.query<Row[]>(
    `SELECT c.DepartmentID, COUNT(*) AS cnt, SUM(c.Status <> 'EMPLOYEE_OPEN') AS sub,
            SUM(e.AnnualAmount) AS exp, SUM(t.AnnualAmount) AS tgt, SUM(a.AnnualAmount) AS alloc
       FROM AppraisalCycle c
       LEFT JOIN AppraisalHike e ON e.CycleID = c.CycleID AND e.Kind = 'EXPECTED' AND e.ByRole = 'EMPLOYEE'
       LEFT JOIN AppraisalHike t ON t.CycleID = c.CycleID AND t.Kind = 'TARGET' AND t.ByRole = 'EMPLOYEE'
       LEFT JOIN AppraisalAllocation a ON a.CycleID = c.CycleID
      WHERE c.PeriodStart = ? GROUP BY c.DepartmentID`, [period]);
  const [ns] = !deps.timed ? await pool.query<Row[]>(
    `SELECT d.DepartmentID, COUNT(DISTINCT u.UserID) AS cnt FROM Department d
       JOIN Users u ON u.IsUserArchived = 0 AND u.UserStatus = 1 AND u.RoleID <> 1
        AND (u.UserID IN (SELECT UserID FROM DepartmentUser du WHERE du.DepartmentID = d.DepartmentID) OR u.UserID = d.ExecutiveLeaderID)
      WHERE d.IsDepartmentArchived = 0 AND NOT EXISTS (SELECT 1 FROM AppraisalCycle c WHERE c.UserID = u.UserID AND c.PeriodStart = ?)
      GROUP BY d.DepartmentID`, [period]) : [[]];
  const [rounds] = await pool.query<Row[]>('SELECT * FROM AppraisalRound WHERE PeriodStart = ?', [period]);
  return depts.map((d) => {
    const id = d['DepartmentID'] as number;
    const a = agg.find((x) => x['DepartmentID'] === id);
    const r = rounds.find((x) => x['DepartmentID'] === id);
    const people = Number(a?.['cnt'] ?? 0) + Number(ns.find((x) => x['DepartmentID'] === id)?.['cnt'] ?? 0);
    const submitted = Number(a?.['sub'] ?? 0);
    const stored = (r?.['Status'] as RoundStatus | undefined) ?? 'COLLECTING';
    return {
      departmentId: id, department: d['DepartmentName'] as string, el: d['ExecutiveLeaderID'] ? { userId: d['ExecutiveLeaderID'] as number, name: (d['ElName'] as string) ?? '' } : null,
      people, submitted, expected: Number(a?.['exp'] ?? 0), target: Number(a?.['tgt'] ?? 0), allocated: Number(a?.['alloc'] ?? 0),
      budget: n(r?.['Budget']), status: stored === 'COLLECTING' && people > 0 && submitted === people ? 'READY_FOR_FINANCE' as RoundStatus : stored,
    };
  });
}

export async function setBudget(actor: number, departmentId: number, period: string, amount: number, comment: string) {
  if (!comment.trim()) throw AppError.badRequest('Write why this budget is given');
  const r = await loadRound(pool, departmentId, period);
  if (!r.el) throw AppError.badRequest('This department has no Executive Leader to give a budget to');
  if (r.status === 'SHARES_WITH_FLS' || r.status === 'FINALISED') throw AppError.conflict('The EL has already split this budget');
  if (amount > MAX_AMOUNT) throw AppError.badRequest('That amount is too large');
  const id = await ensureRound(pool, departmentId, period);
  await pool.execute("UPDATE AppraisalRound SET Budget = ?, FinanceComment = ?, BudgetSetBy = ?, BudgetSetAt = ?, Status = 'BUDGET_WITH_EL' WHERE RoundID = ?", [amount, comment.trim(), actor, new Date(), id]);
  await notify([r.el.userId], `Budget for ${r.department}: ${inr(amount)}`, `Finance Head's note: ${comment.trim()}`, '/appraisal/split', actor);
}

// ── EL: split the budget, approve FL proposals ───────────────────────────────────────────────────

const leads = async (userId: number, departmentId: number) => {
  const [d] = await pool.execute<Row[]>('SELECT 1 FROM Department WHERE DepartmentID = ? AND ExecutiveLeaderID = ?', [departmentId, userId]);
  return d.length > 0;
};
const mustLead = async (userId: number, appRole: number, departmentId: number) => {
  if (appRole !== 1 && !(await leads(userId, departmentId))) throw AppError.forbidden('Only the Executive Leader of this department can do this');
};

/** The rounds of the departments this person leads, newest first */
export async function elRounds(userId: number) {
  const [rows] = await pool.query<Row[]>(
    `SELECT DISTINCT c.DepartmentID, ${D('c.PeriodStart', 'P')} FROM AppraisalCycle c JOIN Department d ON d.DepartmentID = c.DepartmentID
      WHERE d.ExecutiveLeaderID = ? AND d.IsDepartmentArchived = 0 AND c.PeriodStart IS NOT NULL ORDER BY P DESC LIMIT 6`, [userId]);
  const out: Round[] = [];
  for (const r of rows) out.push(await loadRound(pool, r['DepartmentID'] as number, r['P'] as string));
  return out;
}

/** Writes the approved hike and sends the offer to the person (only if they are still waiting for one) */
async function offer(c: Conn, cycleId: number, amount: number, actor: number) {
  const [cy] = await c.execute<Row[]>('SELECT EmployeeLevel, Status FROM AppraisalCycle WHERE CycleID = ?', [cycleId]);
  if (!cy[0] || !['EMPLOYEE_OPEN', 'SUBMITTED'].includes(cy[0]['Status'] as string)) return false;
  const s = splitHike(amount, cy[0]['EmployeeLevel'] as EmployeeLevel);
  await c.execute(
    `INSERT INTO AppraisalHike (CycleID, Kind, ByRole, AnnualAmount, FixedAmount, VariableAmount, VariablePct, EnteredBy) VALUES (?, 'APPROVED', 'FINANCE', ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE AnnualAmount = VALUES(AnnualAmount), FixedAmount = VALUES(FixedAmount), VariableAmount = VALUES(VariableAmount), VariablePct = VALUES(VariablePct), EnteredBy = VALUES(EnteredBy)`,
    [cycleId, s.annualAmount, s.fixed, s.variable, s.variablePct, actor]);
  await c.execute("UPDATE AppraisalCycle SET Status = 'OFFERED' WHERE CycleID = ?", [cycleId]);
  await deps.audit(c, cycleId, actor, 'STATUS_CHANGE', { from: cy[0]['Status'], to: 'OFFERED', annual: amount });
  return true;
}

async function upsertAlloc(c: Conn, cycleId: number, roundId: number, source: Source, flUserId: number | null, amount: number, reason: string | null, actor: number) {
  await c.execute(
    `INSERT INTO AppraisalAllocation (CycleID, RoundID, Source, FlUserID, AnnualAmount, Reason, EnteredBy) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE RoundID = VALUES(RoundID), Source = VALUES(Source), FlUserID = VALUES(FlUserID), AnnualAmount = VALUES(AnnualAmount), Reason = VALUES(Reason), EnteredBy = VALUES(EnteredBy)`,
    [cycleId, roundId, source, flUserId, amount, reason, actor]);
}

/** When every FL proposal is approved and nobody reporting to the EL is waiting, the round is finalised */
async function finaliseIfDone(c: Conn, roundId: number) {
  const [open] = await c.execute<Row[]>("SELECT 1 FROM AppraisalShare WHERE RoundID = ? AND Status <> 'APPROVED' LIMIT 1", [roundId]);
  const [waiting] = await c.execute<Row[]>(
    "SELECT 1 FROM AppraisalAllocation a JOIN AppraisalCycle cy ON cy.CycleID = a.CycleID WHERE a.RoundID = ? AND a.Source IN ('EL_OWN','EL_DIRECT') AND cy.Status IN ('EMPLOYEE_OPEN','SUBMITTED') LIMIT 1", [roundId]);
  if (!open.length && !waiting.length) await c.execute("UPDATE AppraisalRound SET Status = 'FINALISED' WHERE RoundID = ?", [roundId]);
}

export interface SplitInput {
  own?: { amount: number; comment?: string } | null;
  direct?: { cycleId: number; amount: number; reason?: string }[];
  shares?: { flUserId: number; amount: number; comment?: string }[];
  send: boolean;
}

export async function saveSplit(actor: number, appRole: number, departmentId: number, period: string, input: SplitInput) {
  await mustLead(actor, appRole, departmentId);
  const r = await loadRound(pool, departmentId, period);
  if (r.status !== 'BUDGET_WITH_EL' || r.budget == null) throw AppError.conflict(r.budget == null ? 'The Finance Head has not given this department a budget yet' : 'This budget has already been split');
  const own = r.people.find((p) => p.source === 'EL_OWN');
  const direct = r.people.filter((p) => p.source === 'EL_DIRECT');
  if (input.own && !own) throw AppError.badRequest('You have no appraisal in this department to give yourself a hike in');
  for (const d of input.direct ?? []) if (!direct.some((p) => p.cycleId === d.cycleId)) throw AppError.badRequest('That person does not report to you directly in this department');
  for (const s of input.shares ?? []) if (!r.fls.some((f) => f.userId === s.flUserId)) throw AppError.badRequest('That person is not an FL in this department');

  // what the split will be once saved: saved values, overwritten by what was sent now
  const ownAmt = input.own ? input.own.amount : own?.allocation ?? 0;
  const directAmt = direct.reduce((t, p) => t + (input.direct?.find((d) => d.cycleId === p.cycleId)?.amount ?? p.allocation ?? 0), 0);
  const shareAmt = r.fls.reduce((t, f) => t + (input.shares?.find((s) => s.flUserId === f.userId)?.amount ?? r.shares.find((s) => s.flUserId === f.userId)?.amount ?? 0), 0);
  const total = ownAmt + directAmt + shareAmt;
  if (total > r.budget) throw AppError.conflict(`That gives out ${inr(total)} of a ${inr(r.budget)} budget, ${inr(total - r.budget)} too much`);
  if (input.send) {
    if (own && !(input.own ?? (own.allocation != null ? own : null))) throw AppError.badRequest('Enter your own hike before you send');
    for (const p of direct) if ((input.direct?.find((d) => d.cycleId === p.cycleId)?.amount ?? p.allocation) == null) throw AppError.badRequest(`Enter the hike for ${p.name} before you send`);
  }

  await deps.tx(async (c) => {
    const roundId = await ensureRound(c, departmentId, period);
    if (input.own && own) await upsertAlloc(c, own.cycleId, roundId, 'EL_OWN', null, input.own.amount, input.own.comment?.trim() || null, actor);
    for (const d of input.direct ?? []) await upsertAlloc(c, d.cycleId, roundId, 'EL_DIRECT', null, d.amount, d.reason?.trim() || null, actor);
    for (const s of input.shares ?? []) {
      await c.execute(
        `INSERT INTO AppraisalShare (RoundID, FlUserID, Amount, ElComment) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE Amount = VALUES(Amount), ElComment = VALUES(ElComment)`,
        [roundId, s.flUserId, s.amount, s.comment?.trim() || null]);
    }
    if (!input.send) return;
    // every FL gets a share, even an empty one, so their own hike and their team are decided
    for (const f of r.fls) await c.execute('INSERT IGNORE INTO AppraisalShare (RoundID, FlUserID, Amount) VALUES (?, ?, 0)', [roundId, f.userId]);
    await c.execute("UPDATE AppraisalShare SET Status = 'SHARE_RECEIVED' WHERE RoundID = ? AND Status = 'PLANNED'", [roundId]);
    await c.execute("UPDATE AppraisalRound SET Status = 'SHARES_WITH_FLS', ElSentAt = ? WHERE RoundID = ?", [new Date(), roundId]);
    const [mine] = await c.execute<Row[]>("SELECT CycleID, AnnualAmount FROM AppraisalAllocation WHERE RoundID = ? AND Source IN ('EL_OWN','EL_DIRECT')", [roundId]);
    for (const m of mine) await offer(c, m['CycleID'] as number, Number(m['AnnualAmount']), actor);
    await finaliseIfDone(c, roundId);
  });

  if (input.send) {
    const after = await loadRound(pool, departmentId, period);
    for (const s of after.shares) await notify([s.flUserId], `Your team budget: ${inr(s.amount)}`, s.elComment ? `Note from ${r.el?.name ?? 'your EL'}: ${s.elComment}` : `From ${r.el?.name ?? 'your EL'}. Allocate it to your team.`, '/appraisal/allocation', actor);
    const offered = after.people.filter((p) => (p.source === 'EL_OWN' || p.source === 'EL_DIRECT') && p.status === 'OFFERED').map((p) => p.userId);
    await notify(offered, 'Your hike is ready', 'Open My Appraisal to see it.', '/appraisal', actor, 'success');
  }
}

export async function approveShare(actor: number, appRole: number, departmentId: number, period: string, flUserId: number) {
  await mustLead(actor, appRole, departmentId);
  const r = await loadRound(pool, departmentId, period);
  const s = r.shares.find((x) => x.flUserId === flUserId);
  if (!s || s.status !== 'SUBMITTED') throw AppError.conflict('There is no proposal from this FL waiting for you');
  const offered: number[] = [];
  await deps.tx(async (c) => {
    await c.execute("UPDATE AppraisalShare SET Status = 'APPROVED', ApprovedAt = ?, ApprovedBy = ? WHERE RoundID = ? AND FlUserID = ?", [new Date(), actor, r.roundId, flUserId]);
    for (const p of r.people.filter((x) => x.flUserId === flUserId && x.allocation != null)) if (await offer(c, p.cycleId, p.allocation!, actor)) offered.push(p.userId);
    await finaliseIfDone(c, r.roundId!);
  });
  await notify([flUserId], 'Your team allocation is approved', `${r.el?.name ?? 'Your EL'} approved it. Your team can see their hikes now.`, '/appraisal/allocation', actor, 'success');
  await notify(offered, 'Your hike is ready', 'Open My Appraisal to see it.', '/appraisal', actor, 'success');
}

/** After a postponement, a person who reports to the EL directly gets a new hike from the EL */
export async function offerDirect(actor: number, appRole: number, departmentId: number, period: string, cycleId: number, amount: number, reason: string) {
  await mustLead(actor, appRole, departmentId);
  const r = await loadRound(pool, departmentId, period);
  const p = r.people.find((x) => x.cycleId === cycleId && x.source === 'EL_DIRECT');
  if (!p || !r.elSentAt || p.status !== 'SUBMITTED') throw AppError.conflict('There is no hike to decide for this person now');
  await deps.tx(async (c) => {
    await upsertAlloc(c, cycleId, r.roundId!, 'EL_DIRECT', null, amount, reason.trim() || null, actor);
    await offer(c, cycleId, amount, actor);
    await finaliseIfDone(c, r.roundId!);
  });
  await notify([p.userId], 'Your hike is ready', 'Open My Appraisal to see it.', '/appraisal', actor, 'success');
}

// ── FL: allocate the share ───────────────────────────────────────────────────────────────────────

export async function flShares(userId: number) {
  const [rows] = await pool.query<Row[]>(
    `SELECT r.DepartmentID, ${D('r.PeriodStart', 'P')} FROM AppraisalShare s JOIN AppraisalRound r ON r.RoundID = s.RoundID
      WHERE s.FlUserID = ? AND s.Status <> 'PLANNED' ORDER BY r.PeriodStart DESC LIMIT 6`, [userId]);
  const out = [];
  for (const x of rows) {
    const r = await loadRound(pool, x['DepartmentID'] as number, x['P'] as string);
    const share = r.shares.find((s) => s.flUserId === userId)!;
    out.push({
      roundId: r.roundId, departmentId: r.departmentId, department: r.department, period: r.period, el: r.el, share,
      people: r.people.filter((p) => p.flUserId === userId).map((p) => ({ ...p, own: p.source === 'FL_OWN', stage: stageOf(p, r) })),
    });
  }
  return out;
}

/** Waiting for a share: the FL is in a round whose EL has not sent the split yet */
export async function flWaiting(userId: number) {
  const [rows] = await pool.query<Row[]>(
    `SELECT DISTINCT c.DepartmentID, ${D('c.PeriodStart', 'P')} FROM AppraisalCycle c
      WHERE (c.Assessor1UserID = ? OR c.UserID = ?) AND c.DepartmentID IS NOT NULL AND c.PeriodStart IS NOT NULL ORDER BY P DESC LIMIT 4`, [userId, userId]);
  const out = [];
  for (const x of rows) {
    const r = await loadRound(pool, x['DepartmentID'] as number, x['P'] as string);
    if (!r.fls.some((f) => f.userId === userId) || r.elSentAt) continue;
    out.push({ department: r.department, period: r.period, status: r.status, el: r.el, team: r.people.filter((p) => p.flUserId === userId).length, submitted: r.people.filter((p) => p.flUserId === userId && p.status !== 'EMPLOYEE_OPEN').length });
  }
  return out;
}

export interface AllocationInput { items: { cycleId: number; amount: number | null; reason?: string }[]; justification?: string; submit: boolean }

export async function saveAllocation(actor: number, departmentId: number, period: string, input: AllocationInput) {
  const r = await loadRound(pool, departmentId, period);
  const s = r.shares.find((x) => x.flUserId === actor);
  if (!s || !['SHARE_RECEIVED', 'DRAFT'].includes(s.status)) throw AppError.conflict(s?.status === 'SUBMITTED' ? 'Your proposal is with your EL' : 'There is no team budget for you to allocate here');
  const mine = r.people.filter((p) => p.flUserId === actor);
  for (const it of input.items) if (!mine.some((p) => p.cycleId === it.cycleId)) throw AppError.badRequest('That person is not in your team for this budget');
  const amountOf = (p: RoundPerson) => { const it = input.items.find((i) => i.cycleId === p.cycleId); return it ? it.amount : p.allocation; };
  const reasonOf = (p: RoundPerson) => { const it = input.items.find((i) => i.cycleId === p.cycleId); return it ? (it.reason ?? '').trim() : p.reason; };
  const total = mine.reduce((t, p) => t + (amountOf(p) ?? 0), 0);
  if (total > s.amount) throw AppError.conflict(`That gives out ${inr(total)} of your ${inr(s.amount)} budget, ${inr(total - s.amount)} too much`);
  // people whose hike is already out (accepted earlier, or still on offer) are not decided again
  const open = mine.filter((p) => ['EMPLOYEE_OPEN', 'SUBMITTED'].includes(p.status));
  if (input.submit) {
    for (const p of open) {
      if (amountOf(p) == null) throw AppError.badRequest(`Enter the hike for ${p.name}`);
      if (p.source === 'FL_TEAM' && !reasonOf(p)) throw AppError.badRequest(`Write why ${p.name} gets this hike`);
    }
    if (!(input.justification ?? s.justification).trim()) throw AppError.badRequest('Write the justification for the team as a whole');
  }
  await deps.tx(async (c) => {
    for (const it of input.items) {
      const p = mine.find((x) => x.cycleId === it.cycleId)!;
      if (it.amount == null) { await c.execute('DELETE FROM AppraisalAllocation WHERE CycleID = ?', [it.cycleId]); continue; }
      await upsertAlloc(c, it.cycleId, r.roundId!, p.source === 'FL_OWN' ? 'FL_OWN' : 'FL_TEAM', actor, it.amount, (it.reason ?? '').trim() || null, actor);
    }
    await c.execute('UPDATE AppraisalShare SET Status = ?, Justification = COALESCE(?, Justification), SubmittedAt = ? WHERE RoundID = ? AND FlUserID = ?',
      [input.submit ? 'SUBMITTED' : 'DRAFT', input.justification?.trim() ?? null, input.submit ? new Date() : null, r.roundId, actor]);
  });
  if (input.submit) {
    const flName = r.fls.find((f) => f.userId === actor)?.name ?? 'An FL';
    await notify([r.el?.userId], `${flName} sent the team allocation`, `${inr(total)} of ${inr(s.amount)} for ${mine.length} ${mine.length === 1 ? 'person' : 'people'}. Approve it to send the hikes out.`, '/appraisal/split', actor);
  }
}

// ── Postponed hikes coming back ──────────────────────────────────────────────────────────────────

/** After the 3 or 6 months, the person's hike is decided again by whoever decided it: the FL (EL approves) or the EL */
export async function returnPostponed(today: string) {
  const [rows] = await pool.execute<Row[]>(`SELECT CycleID, UserID FROM AppraisalCycle WHERE Status = 'POSTPONED' AND PostponedUntil <= ?`, [today]);
  for (const x of rows) {
    const id = x['CycleID'] as number;
    const [res] = await pool.execute<mysql.ResultSetHeader>("UPDATE AppraisalCycle SET Status = 'SUBMITTED' WHERE CycleID = ? AND Status = 'POSTPONED'", [id]);
    if (!res.affectedRows) continue;
    await pool.execute("DELETE FROM AppraisalHike WHERE CycleID = ? AND Kind = 'APPROVED'", [id]);
    await deps.audit(pool, id, null, 'STATUS_CHANGE', { from: 'POSTPONED', to: 'SUBMITTED' });
    const [a] = await pool.execute<Row[]>('SELECT RoundID, Source, FlUserID FROM AppraisalAllocation WHERE CycleID = ?', [id]);
    if (!a[0]) continue;
    await pool.execute("UPDATE AppraisalRound SET Status = 'SHARES_WITH_FLS' WHERE RoundID = ?", [a[0]['RoundID']]);
    if (a[0]['Source'] === 'FL_TEAM') {
      await pool.execute("UPDATE AppraisalShare SET Status = 'DRAFT', SubmittedAt = NULL WHERE RoundID = ? AND FlUserID = ?", [a[0]['RoundID'], a[0]['FlUserID']]);
      await notify([a[0]['FlUserID'] as number], 'A postponed hike is back with you', 'Decide the hike again and send it to your EL.', '/appraisal/allocation', null);
    } else {
      const [d] = await pool.execute<Row[]>('SELECT d.ExecutiveLeaderID FROM AppraisalRound r JOIN Department d ON d.DepartmentID = r.DepartmentID WHERE r.RoundID = ?', [a[0]['RoundID']]);
      await notify([d[0]?.['ExecutiveLeaderID'] as number], 'A postponed hike is back with you', 'Decide the hike again for someone who reports to you directly.', '/appraisal/split', null);
    }
  }
  return rows.length;
}

export const isElOf = (userId: number, departmentId: number) => leads(userId, departmentId);
