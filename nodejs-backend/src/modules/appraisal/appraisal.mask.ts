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

/** One quarter of the PMS review that Part A shows. Taken from PMS, never typed in the appraisal. */
export interface PmsQuarter {
  quarter: string; year: number; start: string; end: string;
  targetPercent: number | null; goalAchievement: number | null; utilizationPercent: number | null; efficiencyPercent: number | null; efficiencyLabel: string;
  systemGrade: number | null; managerAvgRating: number | null; finalRating: number | null; gradeLabel: string; feedback: { category: string; text: string }[];
}
export type RequestField = 'DESIGNATION' | 'TEAM';
export interface RequestReviews { A1: { comment: string } | null; A2: { comment: string; decision: 'APPROVED' | 'REJECTED' | null } | null }

/** Everything about a cycle, before masking */
export interface FullCycle {
  cycle: {
    id: number; userId: number; employeeName: string; year: number; start: string; employeeWindowEnd: string; assessorWindowEnd: string;
    status: Status; level: EmployeeLevel; variablePct: number; postponedUntil: string | null; currentAnnualCtc: number | null;
    assessor1: Person | null; assessor2: Person | null; late: boolean;
  };
  self: { answers: Record<string, string>; submittedAt: string | null } | null;
  quarters: {
    quarter: number; goals: string; targets: string; comments: string; biggestAchievements: string; biggestFailures: string;
    ratings: { A1: { finalRating: number | null; comments: string } | null; A2: { finalRating: number | null; comments: string } | null };
  }[];
  request: { newDesignation: string; designationComment: string; newTeam: string; teamComment: string } | null;
  pms: PmsQuarter[];
  /** The four quarters of the year the appraisal looks back on, oldest first; quarter n of `quarters` is slot n */
  slots: { n: number; quarter: string; year: number }[];
  requestReviews: Record<RequestField, RequestReviews>;
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
    // Comments travel upwards only: the employee sees none of them, the FL sees their own, the EL sees the FL's too, Finance sees everything.
    const upper = role === 'A2' || role === 'FINANCE';
    const all = role === 'FINANCE';
    const mineOnly = role === 'A1';

    // What the employee wrote and the PMS quarters (Part A): the employee and everyone above
    out['self'] = full.self;
    out['request'] = full.request;
    out['pms'] = full.pms;
    out['slots'] = full.slots;

    // What the FL and the EL said about the requested changes
    if (upper) out['requestReviews'] = full.requestReviews;
    else if (mineOnly) out['requestReviews'] = { DESIGNATION: { A1: full.requestReviews.DESIGNATION.A1, A2: null }, TEAM: { A1: full.requestReviews.TEAM.A1, A2: null } };
    else if (role === 'EMPLOYEE' && offerShown(c.status)) {
      // the employee is told the decision only, never the assessor's words
      const decision = (f: RequestField) => { const d = full.requestReviews[f].A2; return { A2: d && d.decision ? { decision: d.decision } : null }; };
      out['requestReviews'] = { DESIGNATION: decision('DESIGNATION'), TEAM: decision('TEAM') };
    }
    out['quarters'] = full.quarters.map((q) => ({
      quarter: q.quarter,
      ...(role === 'EMPLOYEE' || upper || mineOnly ? { goals: q.goals, targets: q.targets, comments: q.comments, biggestAchievements: q.biggestAchievements, biggestFailures: q.biggestFailures } : {}),
      ...(role === 'EMPLOYEE' ? {} : { ratings: mineOnly ? { A1: q.ratings.A1, A2: null } : q.ratings }),
    }));

    // Expected and target: the employee and Finance only
    if (role === 'EMPLOYEE' || all) {
      out['expected'] = full.expected;
      out['target'] = full.target;
    }
    // Proposed hikes: never the employee; the FL sees only their own; the EL and Finance see both
    if (mineOnly) out['minimal'] = { A1: full.minimal.A1, A2: null };
    else if (role !== 'EMPLOYEE') out['minimal'] = full.minimal;

    // Overall rating, comment, manager feedback: never the employee; the FL their own; the EL both; Finance both
    if (role !== 'EMPLOYEE') {
      const a1 = full.assessors.A1;
      const a2 = full.assessors.A2;
      out['assessors'] = {
        A1: a1 && { overallRating: a1.overallRating, comment: a1.comment, submittedAt: a1.submittedAt, managerFeedback: a1.managerFeedback },
        A2: mineOnly ? null : a2 && { overallRating: a2.overallRating, comment: a2.comment, submittedAt: a2.submittedAt },
      };
    }

    // Approved hike: the EL and Finance always, the employee once the offer is out, the FL never
    if (upper || (role === 'EMPLOYEE' && offerShown(c.status))) out['approved'] = full.approved;
    // Finance's note about the budget goes to the EL only: Finance itself, and the EL when it is the EL's own appraisal
    if (all || (role === 'EMPLOYEE' && c.level === 'HEAD_EL')) out['financeComment'] = full.financeComment;
  }

  out['response'] = full.response;
  return out;
}

// ── Team list rows ────────────────────────────────────────────────────────────────────────────────

export interface TeamRow {
  cycleId: number; userId: number; employeeName: string; level: EmployeeLevel; status: Status; start: string;
  employeeWindowEnd: string; assessorWindowEnd: string; late: boolean;
  selfSubmitted: boolean; a1Submitted: boolean; a2Submitted: boolean; myRole: 'A1' | 'A2' | 'FINANCE';
  assessor1Name: string | null; pmsFinalAvg: number | null; pmsQuarters: number; asksDesignation: boolean; asksTeam: boolean; canApprove: boolean;
  expected: Money | null; minimal: { A1: Money | null; A2: Money | null }; approved: Money | null;
}

/** A1 sees no hike figures but their own proposal; A2 sees both proposals and the approved hike; Finance sees everything */
export function maskTeamRow(row: TeamRow): Record<string, unknown> {
  const base = {
    cycleId: row.cycleId, userId: row.userId, employeeName: row.employeeName, level: row.level, status: row.status, start: row.start,
    employeeWindowEnd: row.employeeWindowEnd, assessorWindowEnd: row.assessorWindowEnd, late: row.late,
    selfSubmitted: row.selfSubmitted, a1Submitted: row.a1Submitted, a2Submitted: row.a2Submitted, myRole: row.myRole,
    assessor1Name: row.assessor1Name, pmsFinalAvg: row.pmsFinalAvg, pmsQuarters: row.pmsQuarters, asksDesignation: row.asksDesignation, asksTeam: row.asksTeam, canApprove: row.canApprove,
  };
  if (row.myRole === 'A1') return { ...base, minimal: row.minimal };
  if (row.myRole === 'A2') return { ...base, minimal: row.minimal, approved: row.approved };
  return { ...base, expected: row.expected, minimal: row.minimal, approved: row.approved };
}
