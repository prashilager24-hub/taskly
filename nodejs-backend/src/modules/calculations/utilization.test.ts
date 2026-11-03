import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/db', () => ({ pool: {} }));

import { calculateEfficiency, calculateUtilization, round2, type DailyEfficiencyInput } from './calculationLogic';

describe('calculateUtilization: day', () => {
  it('is time taken over the standard hours', () => {
    expect(calculateUtilization({ kind: 'day', departmentId: 1, halfDayLeave: false, timeTakenHrs: 6, level: 'High' })).toBe(75);
    expect(calculateUtilization({ kind: 'day', departmentId: 1, halfDayLeave: true, timeTakenHrs: 3, level: 'High' })).toBe(75);
  });

  it('uses the special-hours standards', () => {
    expect(calculateUtilization({ kind: 'day', departmentId: 3, halfDayLeave: false, timeTakenHrs: 7, level: 'High' })).toBe(100);
    expect(calculateUtilization({ kind: 'day', departmentId: 3, halfDayLeave: true, timeTakenHrs: 3.5, level: 'High' })).toBe(100);
    expect(calculateUtilization({ kind: 'day', departmentId: 48, halfDayLeave: false, timeTakenHrs: 20, level: 'High' })).toBe(50);
    expect(calculateUtilization({ kind: 'day', departmentId: 48, halfDayLeave: true, timeTakenHrs: 20, level: 'High' })).toBe(100);
  });

  it('holds a Low day at 100 but lets a High day go over', () => {
    expect(calculateUtilization({ kind: 'day', departmentId: 1, halfDayLeave: false, timeTakenHrs: 10, level: 'Low' })).toBe(100);
    expect(calculateUtilization({ kind: 'day', departmentId: 1, halfDayLeave: false, timeTakenHrs: 10, level: 'High' })).toBe(125);
  });

  it('is what the daily efficiency row carries', () => {
    const input: DailyEfficiencyInput = {
      departmentId: 1, date: '2026-10-05', allocatedHrs: 8, timeTakenHrs: 7.5, averageUnitPercent: 100, halfDayLeave: false,
      goal: { average: 0, dept19: { achieved67: 0, achieved68: 0, fixed67: 0, fixed68: 0 }, totals: { fixed: 0, achieved: 0 } },
    };
    const row = calculateEfficiency({ kind: 'day', ...input });
    expect(row.utilizationPercent).toBe(calculateUtilization({ kind: 'day', departmentId: 1, halfDayLeave: false, timeTakenHrs: 7.5, level: row.efficiencyLevel }));
  });
});

describe('calculateUtilization: average', () => {
  it('rounds the mean to 2 places', () => {
    expect(calculateUtilization({ kind: 'average', values: [100, 50, 25] })).toBe(round2(175 / 3));
    expect(calculateUtilization({ kind: 'average', values: ['80', 90] })).toBe(85);
  });

  it('is 0 with nothing to average', () => {
    expect(calculateUtilization({ kind: 'average', values: [] })).toBe(0);
    expect(calculateUtilization({ kind: 'average', values: [], skipMissing: true })).toBe(0);
  });

  it('counts a missing value as 0, unless told to leave it out', () => {
    expect(calculateUtilization({ kind: 'average', values: [100, null, undefined] })).toBe(33.33);
    expect(calculateUtilization({ kind: 'average', values: [100, null, undefined], skipMissing: true })).toBe(100);
  });
});
