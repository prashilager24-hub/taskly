/**
 * What each role may see of a cycle. The server removes what a role must not see: a hidden key is absent
 * from the JSON, never null. One function (maskCycle) so the rule lives in one place.
 */
import type { EmployeeLevel } from './appraisal.calc';

export type ViewRole = 'EMPLOYEE' | 'A1' | 'A2' | 'FINANCE' | 'HR';
export type Status = 'EMPLOYEE_OPEN' | 'ASSESSOR_OPEN' | 'FINANCE_REVIEW' | 'OFFERED' | 'ACCEPTED' | 'POSTPONED';
export type HikeKind = 'EXPECTED' | 'TARGET' | 'MINIMAL' | 'APPROVED';

export interface Money { annual: number; fixed: number; variable: number; variablePct: number; variablePerHalfYear: number }
export interface Person { userId: number; name: string }

/** Everything about a cycle, before masking */
export interface FullCycle {
  cycle: {
    id: number; userId: number; employeeName: string; year: number; start: string; employeeWindowEnd: string; assessorWindowEnd: string;
    status: Status; level: EmployeeLevel; variablePct: number; postponedUntil: string | null; currentAnnualCtc: number | null;
    assessor1: Person | null; assessor2: Person | null; late: boolean;
  };
  self: { answers: Record<string, string>; submittedAt: string | null } | null;
  quarters: {
    quarter: number; goals: string; targets: string; biggestAchievements: string; biggestFailures: string;
    ratings: { A1: { finalRating: number | null; comments: string } | null; A2: { finalRating: number | null; comments: string } | null };
  }[];
  request: { newDesignation: string; designationComment: string; newTeam: string; teamComment: string } | null;
  expected: Money | null;
  target: Money | null;
  minimal: { A1: Money | null; A2: Money | null };
  approved: Money | null;
  assessors: { A1: { overallRating: number | null; comment: string; managerFeedback: string; submittedAt: string | null } | null; A2: { overallRating: number | null; comment: string; managerFeedback: string; submittedAt: string | null } | null };
  financeComment: string | null;
  response: { decision: 'ACCEPT' | 'REJECT'; postponeMonths: number | null; reason: string; expectations: string; comment: string; hrStatus: 'PENDING' | 'APPROVED' | 'RETURNED' | null; hrComment: string; decidedAt: string } | null;
}

/** Offer is out: the employee may now see ratings and the approved hike */
const offerShown = (s: Status) => s === 'OFFERED' || s === 'ACCEPTED' || s === 'POSTPONED';

export function maskCycle(full: FullCycle, role: ViewRole): Record<string, unknown> {
  const c = full.cycle;
  const out: Record<string, unknown> = {
    role,
    cycle: {
      id: c.id, userId: c.userId, employeeName: c.employeeName, year: c.year, start: c.start,
      employeeWindowEnd: c.employeeWindowEnd, assessorWindowEnd: c.assessorWindowEnd,
      status: c.status, level: c.level, variablePct: c.variablePct, postponedUntil: c.postponedUntil,
      assessor1: c.assessor1, assessor2: c.assessor2, late: c.late,
      ...(role === 'EMPLOYEE' || role === 'FINANCE' ? { currentAnnualCtc: c.currentAnnualCtc } : {}),
    },
  };

  // HR sees the person and the decision, nothing of the review itself
  if (role !== 'HR') {
    const ratingsVisible = role !== 'EMPLOYEE' || offerShown(c.status);
    const sees = role === 'EMPLOYEE' || role === 'A1' || role === 'A2';

    // Self review text and the quarter grid the employee wrote: employee, A1, A2
    if (sees) {
      out['self'] = full.self;
      out['request'] = full.request;
    }
    out['quarters'] = full.quarters.map((q) => ({
      quarter: q.quarter,
      ...(sees ? { goals: q.goals, targets: q.targets, biggestAchievements: q.biggestAchievements, biggestFailures: q.biggestFailures } : {}),
      ...(ratingsVisible ? { ratings: q.ratings } : {}),
    }));

    // Expected and target: the employee and Finance only
    if (role === 'EMPLOYEE' || role === 'FINANCE') {
      out['expected'] = full.expected;
      out['target'] = full.target;
    }
    // Minimal: assessors and Finance, never the employee
    if (role !== 'EMPLOYEE') out['minimal'] = full.minimal;

    // Overall rating and comment: assessors and Finance always, the employee once the offer is out. Manager feedback: A1 and A2 only.
    if (ratingsVisible) {
      out['assessors'] = {
        A1: full.assessors.A1 && { overallRating: full.assessors.A1.overallRating, comment: full.assessors.A1.comment, submittedAt: full.assessors.A1.submittedAt, ...(role === 'A1' || role === 'A2' ? { managerFeedback: full.assessors.A1.managerFeedback } : {}) },
        A2: full.assessors.A2 && { overallRating: full.assessors.A2.overallRating, comment: full.assessors.A2.comment, submittedAt: full.assessors.A2.submittedAt },
      };
    }

    // Approved hike: A2 and Finance always, the employee after the offer, A1 never
    if (role === 'A2' || role === 'FINANCE' || (role === 'EMPLOYEE' && offerShown(c.status))) out['approved'] = full.approved;
    if (role === 'FINANCE') out['financeComment'] = full.financeComment;
  }

  out['response'] = full.response;
  return out;
}

// ── Team list rows ────────────────────────────────────────────────────────────────────────────────

export interface TeamRow {
  cycleId: number; userId: number; employeeName: string; level: EmployeeLevel; status: Status; start: string;
  employeeWindowEnd: string; assessorWindowEnd: string; late: boolean;
  selfSubmitted: boolean; a1Submitted: boolean; a2Submitted: boolean; myRole: 'A1' | 'A2' | 'FINANCE';
  expected: Money | null; minimal: { A1: Money | null; A2: Money | null }; approved: Money | null;
}

/** A1 sees no hike figures but their own minimal; A2 sees minimal and approved; Finance sees everything but the review text */
export function maskTeamRow(row: TeamRow): Record<string, unknown> {
  const base = {
    cycleId: row.cycleId, userId: row.userId, employeeName: row.employeeName, level: row.level, status: row.status, start: row.start,
    employeeWindowEnd: row.employeeWindowEnd, assessorWindowEnd: row.assessorWindowEnd, late: row.late,
    selfSubmitted: row.selfSubmitted, a1Submitted: row.a1Submitted, a2Submitted: row.a2Submitted, myRole: row.myRole,
  };
  if (row.myRole === 'A1') return { ...base, minimal: row.minimal };
  if (row.myRole === 'A2') return { ...base, minimal: row.minimal, approved: row.approved };
  return { ...base, expected: row.expected, minimal: row.minimal, approved: row.approved };
}
