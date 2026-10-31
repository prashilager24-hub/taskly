import { describe, expect, it } from 'vitest';
import { addDays, addMonths, currentCycleStart, cycleMonthOf, cycleWindows, isAnniversary, quarterSlots, splitHike, todayIST } from './appraisal.calc';

describe('April / October cycle', () => {
  it('December to May joiners are in April, June to November in October', () => {
    expect(['2023-12-15', '2024-01-02', '2024-05-31'].map(cycleMonthOf)).toEqual(['APRIL', 'APRIL', 'APRIL']);
    expect(['2024-06-01', '2024-08-20', '2024-11-30'].map(cycleMonthOf)).toEqual(['OCTOBER', 'OCTOBER', 'OCTOBER']);
  });
  it('the current start is the latest 1 April / 1 October on or before today', () => {
    expect(currentCycleStart('OCTOBER', '2026-10-30')).toBe('2026-10-01');
    expect(currentCycleStart('OCTOBER', '2026-09-30')).toBe('2025-10-01');
    expect(currentCycleStart('APRIL', '2026-10-30')).toBe('2026-04-01');
    expect(currentCycleStart('APRIL', '2026-04-01')).toBe('2026-04-01');
    expect(currentCycleStart('APRIL', '2026-03-31')).toBe('2025-04-01');
  });
});

describe('splitHike', () => {
  it('ASSOCIATE 100000 -> 90000 fixed + 10000 variable', () => {
    expect(splitHike(100000, 'ASSOCIATE')).toMatchObject({ fixed: 90000, variable: 10000, variablePct: 10, variablePerHalfYear: 5000 });
  });
  it('MANAGER 100000 -> 80000 + 20000', () => {
    expect(splitHike(100000, 'MANAGER')).toMatchObject({ fixed: 80000, variable: 20000, variablePct: 20 });
  });
  it('HEAD_EL 100000 -> 70000 + 30000', () => {
    expect(splitHike(100000, 'HEAD_EL')).toMatchObject({ fixed: 70000, variable: 30000, variablePct: 30 });
  });
  it('rounding keeps the sum exact: ASSOCIATE 55555 -> 5556 variable, 49999 fixed', () => {
    const s = splitHike(55555, 'ASSOCIATE');
    expect(s.variable).toBe(5556);
    expect(s.fixed).toBe(49999);
    expect(s.fixed + s.variable).toBe(55555);
  });
});

describe('dates', () => {
  it('windows: day 15 and day 30 of the cycle', () => {
    expect(cycleWindows('2026-11-02')).toEqual({ employeeWindowEnd: '2026-11-16', assessorWindowEnd: '2026-12-01' });
  });
  it('addDays crosses month and year ends', () => {
    expect(addDays('2026-12-25', 14)).toBe('2027-01-08');
  });
  it('addMonths clamps to the last day of a short month', () => {
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
    expect(addMonths('2026-12-15', 3)).toBe('2027-03-15');
  });
  it('anniversary matches month and day, and 29 Feb joiners on 28 Feb in non-leap years', () => {
    expect(isAnniversary('2022-11-02', '2026-11-02')).toBe(true);
    expect(isAnniversary('2022-11-02', '2026-11-03')).toBe(false);
    expect(isAnniversary('2024-02-29', '2026-02-28')).toBe(true);
    expect(isAnniversary('2024-02-29', '2028-02-29')).toBe(true);
    expect(isAnniversary('2024-02-29', '2028-02-28')).toBe(false);
  });
  it('quarter slots: the four quarters that ended before the cycle, oldest first', () => {
    expect(quarterSlots('2026-10-29').map((s) => `${s.quarter} ${s.year}`)).toEqual(['Q4 2025', 'Q1 2026', 'Q2 2026', 'Q3 2026']);
    expect(quarterSlots('2026-09-30').map((s) => `${s.quarter} ${s.year}`)).toEqual(['Q4 2025', 'Q1 2026', 'Q2 2026', 'Q3 2026']);
    expect(quarterSlots('2026-02-10').map((s) => `${s.quarter} ${s.year}`)).toEqual(['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025']);
    expect(quarterSlots('2026-10-29').map((s) => s.n)).toEqual([1, 2, 3, 4]);
  });
  it('todayIST uses the India calendar day', () => {
    expect(todayIST(new Date('2026-10-28T20:00:00Z'))).toBe('2026-10-29');
  });
});
