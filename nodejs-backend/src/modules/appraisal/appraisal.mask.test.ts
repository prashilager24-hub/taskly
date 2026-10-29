import { describe, expect, it } from 'vitest';
import { splitHike } from './appraisal.calc';
import { maskCycle, maskTeamRow, type FullCycle, type Status, type TeamRow } from './appraisal.mask';

const money = (n: number) => { const s = splitHike(n, 'ASSOCIATE'); return { annual: s.annualAmount, fixed: s.fixed, variable: s.variable, variablePct: s.variablePct, variablePerHalfYear: s.variablePerHalfYear }; };

const full = (status: Status): FullCycle => ({
  cycle: { id: 1, userId: 10, employeeName: 'Asha', year: 2026, start: '2026-11-02', employeeWindowEnd: '2026-11-16', assessorWindowEnd: '2026-12-01', status, level: 'ASSOCIATE', variablePct: 10, postponedUntil: null, currentAnnualCtc: 600000, assessor1: { userId: 20, name: 'Ben' }, assessor2: { userId: 30, name: 'Cara' }, late: false },
  self: { answers: { goalsAchieved: 'all' }, submittedAt: '2026-11-10 10:00:00' },
  quarters: [{ quarter: 1, goals: 'g', targets: 't', comments: 'c', biggestAchievements: 'a', biggestFailures: 'f', ratings: { A1: { finalRating: 4, comments: 'good' }, A2: { finalRating: 3.5, comments: 'ok' } } }],
  request: { newDesignation: 'Lead', designationComment: 'c', newTeam: '', teamComment: '' },
  pms: [{ quarter: 'Q3', year: 2026, start: '2026-07-01', end: '2026-09-30', targetPercent: 90, goalAchievement: 80, utilizationPercent: 70, efficiencyPercent: 100, efficiencyLabel: 'At Par', systemGrade: 8, managerAvgRating: 6, finalRating: 8, gradeLabel: 'Meets Expectations', feedback: [], comments: '', achievements: '', failures: '' }],
  slots: [{ n: 1, quarter: 'Q3', year: 2026 }],
  requestReviews: { DESIGNATION: { A1: { comment: 'fl says yes' }, A2: { comment: 'el decides', decision: 'APPROVED' } }, TEAM: { A1: null, A2: null } },
  expected: money(100000), target: money(80000), minimal: { A1: money(50000), A2: money(60000) }, approved: money(70000),
  assessors: { A1: { overallRating: 4, comment: 'strong', managerFeedback: 'private note', submittedAt: 'x' }, A2: { overallRating: 3.5, comment: 'fine', managerFeedback: 'ignored', submittedAt: 'x' } },
  financeComment: 'within budget',
  response: null,
});

const has = (o: unknown, k: string) => Object.prototype.hasOwnProperty.call(o as object, k);
const as = (o: Record<string, unknown>, k: string) => o[k] as Record<string, unknown>;

describe('maskCycle: comments travel upwards only', () => {
  it('EMPLOYEE: sees each assessor hike and comment once submitted; never their rating, manager feedback or quarter ratings', () => {
    for (const st of ['ASSESSOR_OPEN', 'OFFERED', 'ACCEPTED'] as const) {
      const m = maskCycle(full(st), 'EMPLOYEE');
      const a = m['assessors'] as Record<string, Record<string, unknown>>;
      expect(a['A1'], st).toEqual({ comment: 'strong', submittedAt: 'x' });
      expect(a['A2'], st).toEqual({ comment: 'fine', submittedAt: 'x' });
      expect((m['minimal'] as Record<string, { annual: number }>)['A1']!.annual).toBe(50000);
      expect(has(m, 'financeComment'), st).toBe(false);
      expect(has((m['quarters'] as object[])[0], 'ratings'), st).toBe(false);
      for (const k of ['self', 'request', 'pms', 'expected', 'target']) expect(has(m, k), k).toBe(true);
    }
    expect(has(maskCycle(full('ASSESSOR_OPEN'), 'EMPLOYEE'), 'approved')).toBe(false);
    expect(has(maskCycle(full('OFFERED'), 'EMPLOYEE'), 'approved')).toBe(true);
  });
  it('EMPLOYEE: a draft review shows nothing, neither hike nor comment', () => {
    const f = full('ASSESSOR_OPEN');
    f.assessors.A2 = { ...f.assessors.A2!, submittedAt: null };
    const m = maskCycle(f, 'EMPLOYEE');
    expect((m['assessors'] as Record<string, unknown>)['A2']).toBeNull();
    expect((m['minimal'] as Record<string, unknown>)['A2']).toBeNull();
  });
  it('EMPLOYEE after the offer is told the EL decision only, never the words', () => {
    const rr = as(maskCycle(full('OFFERED'), 'EMPLOYEE'), 'requestReviews') as { DESIGNATION: Record<string, unknown> };
    expect(has(rr.DESIGNATION, 'A1')).toBe(false);
    expect(rr.DESIGNATION['A2']).toEqual({ decision: 'APPROVED' });
    expect(has(maskCycle(full('ASSESSOR_OPEN'), 'EMPLOYEE'), 'requestReviews')).toBe(false);
  });
  it('FL (A1): sees the Associate and their own review only; nothing the EL wrote, no expected / target / approved', () => {
    const m = maskCycle(full('ASSESSOR_OPEN'), 'A1');
    for (const k of ['expected', 'target', 'approved', 'financeComment']) expect(has(m, k), k).toBe(false);
    for (const k of ['self', 'request', 'pms']) expect(has(m, k), k).toBe(true);
    expect(as(m, 'assessors')['A2']).toBeNull();
    expect(has(as(m, 'assessors')['A1'] as object, 'managerFeedback')).toBe(true);
    expect(as(m, 'minimal')['A2']).toBeNull();
    expect(as(m, 'minimal')['A1']).not.toBeNull();
    const rr = as(m, 'requestReviews') as { DESIGNATION: Record<string, unknown> };
    expect(rr.DESIGNATION['A2']).toBeNull();
    expect(rr.DESIGNATION['A1']).toEqual({ comment: 'fl says yes' });
    expect((m['quarters'] as { ratings: Record<string, unknown> }[])[0]!.ratings['A2']).toBeNull();
  });
  it('EL (A2): sees the Associate, the FL review with manager feedback, both proposals and the approved hike; no expected / target', () => {
    const m = maskCycle(full('FINANCE_REVIEW'), 'A2');
    for (const k of ['expected', 'target', 'financeComment']) expect(has(m, k), k).toBe(false);
    expect(has(m, 'approved')).toBe(true);
    expect(has(as(m, 'assessors')['A1'] as object, 'managerFeedback')).toBe(true);
    expect(as(m, 'assessors')['A2']).not.toBeNull();
    expect(as(m, 'minimal')['A1']).not.toBeNull();
    expect(has(m, 'requestReviews')).toBe(true);
  });
  it('FINANCE: sees everything, including the self review, PMS, requests, both reviews and manager feedback', () => {
    const m = maskCycle(full('FINANCE_REVIEW'), 'FINANCE');
    for (const k of ['self', 'request', 'pms', 'requestReviews', 'expected', 'target', 'minimal', 'approved', 'assessors', 'financeComment']) expect(has(m, k), k).toBe(true);
    expect(has(as(m, 'assessors')['A1'] as object, 'managerFeedback')).toBe(true);
    expect(has((m['quarters'] as object[])[0], 'goals')).toBe(true);
  });
  it('HR: only the person, the cycle and the decision', () => {
    const m = maskCycle(full('POSTPONED'), 'HR');
    expect(Object.keys(m).sort()).toEqual(['cycle', 'response', 'role']);
    expect(has(m['cycle'], 'currentAnnualCtc')).toBe(false);
  });
  it('Finance note about the budget reaches the EL only when it is the EL appraisal', () => {
    const el = full('FINANCE_REVIEW');
    el.cycle.level = 'HEAD_EL';
    expect(has(maskCycle(el, 'EMPLOYEE'), 'financeComment')).toBe(true);
    expect(has(maskCycle(full('FINANCE_REVIEW'), 'EMPLOYEE'), 'financeComment')).toBe(false);
    for (const r of ['A1', 'A2', 'HR'] as const) expect(has(maskCycle(el, r), 'financeComment'), r).toBe(false);
  });
});

describe('maskTeamRow', () => {
  const row = (myRole: TeamRow['myRole']): TeamRow => ({ cycleId: 1, userId: 10, employeeName: 'Asha', level: 'ASSOCIATE', status: 'FINANCE_REVIEW', start: '2026-11-02', employeeWindowEnd: 'a', assessorWindowEnd: 'b', late: false, selfSubmitted: true, a1Submitted: true, a2Submitted: false, myRole, assessor1Name: 'Ben', pmsFinalAvg: 8, pmsQuarters: 1, asksDesignation: true, asksTeam: false, canApprove: false, requestsPending: false, canDecideRequests: false, expected: money(1), minimal: { A1: money(2), A2: null }, approved: money(3) });
  it('A1 sees no expected or approved', () => { const m = maskTeamRow(row('A1')); expect(has(m, 'expected')).toBe(false); expect(has(m, 'approved')).toBe(false); });
  it('A2 sees approved but not expected', () => { const m = maskTeamRow(row('A2')); expect(has(m, 'approved')).toBe(true); expect(has(m, 'expected')).toBe(false); });
  it('FINANCE sees all three', () => { const m = maskTeamRow(row('FINANCE')); for (const k of ['expected', 'minimal', 'approved']) expect(has(m, k)).toBe(true); });
});
