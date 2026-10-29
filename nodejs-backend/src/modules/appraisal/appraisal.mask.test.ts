import { describe, expect, it } from 'vitest';
import { splitHike } from './appraisal.calc';
import { maskCycle, maskTeamRow, type FullCycle, type Status, type TeamRow } from './appraisal.mask';

const money = (n: number) => { const s = splitHike(n, 'ASSOCIATE'); return { annual: s.annualAmount, fixed: s.fixed, variable: s.variable, variablePct: s.variablePct, variablePerHalfYear: s.variablePerHalfYear }; };

const full = (status: Status): FullCycle => ({
  cycle: { id: 1, userId: 10, employeeName: 'Asha', year: 2026, start: '2026-11-02', employeeWindowEnd: '2026-11-16', assessorWindowEnd: '2026-12-01', status, level: 'ASSOCIATE', variablePct: 10, postponedUntil: null, currentAnnualCtc: 600000, assessor1: { userId: 20, name: 'Ben' }, assessor2: { userId: 30, name: 'Cara' }, late: false },
  self: { answers: { goalsAchieved: 'all' }, submittedAt: '2026-11-10 10:00:00' },
  quarters: [{ quarter: 1, goals: 'g', targets: 't', biggestAchievements: 'a', biggestFailures: 'f', ratings: { A1: { finalRating: 4, comments: 'good' }, A2: { finalRating: 3.5, comments: 'ok' } } }],
  request: { newDesignation: 'Lead', designationComment: 'c', newTeam: '', teamComment: '' },
  pms: [{ quarter: 'Q3', year: 2026, start: '2026-07-01', end: '2026-09-30', targetPercent: 90, goalAchievement: 80, utilizationPercent: 70, efficiencyPercent: 100, efficiencyLabel: 'At Par', systemGrade: 8, managerAvgRating: 6, finalRating: 8, gradeLabel: 'Meets Expectations', feedback: [] }],
  requestReviews: { DESIGNATION: { A1: { comment: 'fl says yes' }, A2: { comment: 'el decides', decision: 'APPROVED' } }, TEAM: { A1: null, A2: null } },
  expected: money(100000), target: money(80000), minimal: { A1: money(50000), A2: money(60000) }, approved: money(70000),
  assessors: { A1: { overallRating: 4, comment: 'strong', managerFeedback: 'private note', submittedAt: 'x' }, A2: { overallRating: 3.5, comment: 'fine', managerFeedback: 'ignored', submittedAt: 'x' } },
  financeComment: 'within budget',
  response: null,
});

const has = (o: unknown, k: string) => Object.prototype.hasOwnProperty.call(o as object, k);

describe('maskCycle: hidden keys are absent, not null', () => {
  it('EMPLOYEE while assessing: no minimal, no ratings, no approved, no manager feedback', () => {
    const m = maskCycle(full('ASSESSOR_OPEN'), 'EMPLOYEE');
    for (const k of ['minimal', 'assessors', 'approved', 'financeComment']) expect(has(m, k), k).toBe(false);
    expect(has(m, 'expected')).toBe(true);
    expect(has(m, 'self')).toBe(true);
    expect(has((m['quarters'] as object[])[0], 'ratings')).toBe(false);
  });
  it('EMPLOYEE once offered: sees ratings and approved, still no minimal and no manager feedback', () => {
    const m = maskCycle(full('OFFERED'), 'EMPLOYEE');
    expect(has(m, 'approved')).toBe(true);
    expect(has(m, 'minimal')).toBe(false);
    expect(has((m['assessors'] as { A1: object }).A1, 'managerFeedback')).toBe(false);
    expect(has((m['quarters'] as object[])[0], 'ratings')).toBe(true);
  });
  it('A1: no expected, target or approved; has minimal and own manager feedback', () => {
    const m = maskCycle(full('ASSESSOR_OPEN'), 'A1');
    for (const k of ['expected', 'target', 'approved', 'financeComment']) expect(has(m, k), k).toBe(false);
    expect(has(m, 'minimal')).toBe(true);
    expect(has((m['assessors'] as { A1: object }).A1, 'managerFeedback')).toBe(true);
  });
  it('A2: sees manager feedback and approved, but no expected or target', () => {
    const m = maskCycle(full('FINANCE_REVIEW'), 'A2');
    for (const k of ['expected', 'target', 'financeComment']) expect(has(m, k), k).toBe(false);
    expect(has(m, 'approved')).toBe(true);
    expect(has((m['assessors'] as { A1: object }).A1, 'managerFeedback')).toBe(true);
  });
  it('FINANCE: no review text, no manager feedback; sees hikes', () => {
    const m = maskCycle(full('FINANCE_REVIEW'), 'FINANCE');
    for (const k of ['self', 'request']) expect(has(m, k), k).toBe(false);
    for (const k of ['expected', 'target', 'minimal', 'approved']) expect(has(m, k), k).toBe(true);
    expect(has((m['assessors'] as { A1: object }).A1, 'managerFeedback')).toBe(false);
    expect(has((m['quarters'] as object[])[0], 'goals')).toBe(false);
  });
  it('HR: only the person, the cycle and the decision', () => {
    const m = maskCycle(full('POSTPONED'), 'HR');
    expect(Object.keys(m).sort()).toEqual(['cycle', 'response', 'role']);
    expect(has(m['cycle'], 'currentAnnualCtc')).toBe(false);
  });
});

describe('Part A (PMS), request reviews and the Finance note', () => {
  it('PMS data goes to the employee and the assessors, not to Finance or HR', () => {
    for (const r of ['EMPLOYEE', 'A1', 'A2'] as const) expect(has(maskCycle(full('ASSESSOR_OPEN'), r), 'pms'), r).toBe(true);
    for (const r of ['FINANCE', 'HR'] as const) expect(has(maskCycle(full('ASSESSOR_OPEN'), r), 'pms'), r).toBe(false);
  });
  it('the employee sees nothing of the request reviews while assessing', () => {
    expect(has(maskCycle(full('ASSESSOR_OPEN'), 'EMPLOYEE'), 'requestReviews')).toBe(false);
  });
  it('after the offer the employee sees only the EL decision, never the FL comment', () => {
    const rr = maskCycle(full('OFFERED'), 'EMPLOYEE')['requestReviews'] as { DESIGNATION: Record<string, unknown> };
    expect(has(rr.DESIGNATION, 'A1')).toBe(false);
    expect(rr.DESIGNATION['A2']).toEqual({ comment: 'el decides', decision: 'APPROVED' });
  });
  it('the FL and EL see both comments; Finance and HR see none', () => {
    for (const r of ['A1', 'A2'] as const) expect(has(maskCycle(full('ASSESSOR_OPEN'), r), 'requestReviews'), r).toBe(true);
    for (const r of ['FINANCE', 'HR'] as const) expect(has(maskCycle(full('ASSESSOR_OPEN'), r), 'requestReviews'), r).toBe(false);
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
  const row = (myRole: TeamRow['myRole']): TeamRow => ({ cycleId: 1, userId: 10, employeeName: 'Asha', level: 'ASSOCIATE', status: 'FINANCE_REVIEW', start: '2026-11-02', employeeWindowEnd: 'a', assessorWindowEnd: 'b', late: false, selfSubmitted: true, a1Submitted: true, a2Submitted: false, myRole, assessor1Name: 'Ben', pmsFinalAvg: 8, pmsQuarters: 1, asksDesignation: true, asksTeam: false, canApprove: false, expected: money(1), minimal: { A1: money(2), A2: null }, approved: money(3) });
  it('A1 sees no expected or approved', () => { const m = maskTeamRow(row('A1')); expect(has(m, 'expected')).toBe(false); expect(has(m, 'approved')).toBe(false); });
  it('A2 sees approved but not expected', () => { const m = maskTeamRow(row('A2')); expect(has(m, 'approved')).toBe(true); expect(has(m, 'expected')).toBe(false); });
  it('FINANCE sees all three', () => { const m = maskTeamRow(row('FINANCE')); for (const k of ['expected', 'minimal', 'approved']) expect(has(m, k)).toBe(true); });
});
