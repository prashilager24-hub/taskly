import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/db', () => ({ pool: {} }));

import { calculateEfficiency, type DailyEfficiencyInput } from './calculationLogic';

const goal = { average: 0, dept19: { achieved67: 0, achieved68: 0, fixed67: 0, fixed68: 0 }, totals: { fixed: 0, achieved: 0 } };
const day = (over: Partial<DailyEfficiencyInput>): DailyEfficiencyInput => ({
  departmentId: 7, date: '2026-10-05', allocatedHrs: 8, timeTakenHrs: 7, averageUnitPercent: 100, halfDayLeave: false, goal, ...over,
});

describe('calculateEfficiency: a day', () => {
  it('is High when target, goal and time are all met', () => {
    expect(calculateEfficiency({ kind: 'day', ...day({}) }).efficiencyLevel).toBe('High');
  });

  it('drops to At Par or Low as the target falls', () => {
    expect(calculateEfficiency({ kind: 'day', ...day({ averageUnitPercent: 85 }) }).efficiencyLevel).toBe('At Par');
    expect(calculateEfficiency({ kind: 'day', ...day({ averageUnitPercent: 60 }) }).efficiencyLevel).toBe('Low');
  });

  it('is Low when more time was taken than allocated', () => {
    expect(calculateEfficiency({ kind: 'day', ...day({ timeTakenHrs: 9 }) }).efficiencyLevel).toBe('Low');
  });

  it('scores a TAM account and a closed position by their target', () => {
    expect(calculateEfficiency({ kind: 'positionClosed', achievedGoal: 30 }).targetAchievedPercent).toBe(100);
    expect(calculateEfficiency({ kind: 'positionClosed', achievedGoal: 55 }).targetAchievedPercent).toBe(90);
    expect(calculateEfficiency({ kind: 'liveAccount', entryDate: '2026-10-05', liveDate: '2026-10-07' }).efficiencyLevel).toBe('High');
  });
});

describe('calculateEfficiency: the level of an average', () => {
  it('scores levels, with a missing one as 0', () => {
    expect(calculateEfficiency({ kind: 'levelScore', level: 'High' })).toBe(3);
    expect(calculateEfficiency({ kind: 'levelScore', level: ' at par ' })).toBe(2);
    expect(calculateEfficiency({ kind: 'levelScore', level: 'Low' })).toBe(1);
    expect(calculateEfficiency({ kind: 'levelScore', level: null })).toBe(0);
  });

  it('turns an average score back into a level', () => {
    expect(calculateEfficiency({ kind: 'scoreLevel', score: 2.5 })).toBe('High');
    expect(calculateEfficiency({ kind: 'scoreLevel', score: 2.49 })).toBe('At Par');
    expect(calculateEfficiency({ kind: 'scoreLevel', score: 1.5 })).toBe('At Par');
    expect(calculateEfficiency({ kind: 'scoreLevel', score: 1.49 })).toBe('Low');
    expect(calculateEfficiency({ kind: 'scoreLevel', score: 0 })).toBe('Low');
  });

  it('grades a period by its average target and utilization', () => {
    expect(calculateEfficiency({ kind: 'periodLevel', target: 100, utilization: 80 })).toBe('High');
    expect(calculateEfficiency({ kind: 'periodLevel', target: 100, utilization: 79 })).toBe('At Par');
    expect(calculateEfficiency({ kind: 'periodLevel', target: 80, utilization: 50 })).toBe('At Par');
    expect(calculateEfficiency({ kind: 'periodLevel', target: 79, utilization: 90 })).toBe('Low');
  });

  it('grades a person\'s summary by target and whether the work fitted the allocated hours', () => {
    expect(calculateEfficiency({ kind: 'reportLevel', target: 100, worked: 7, allocated: 8 })).toBe('High');
    expect(calculateEfficiency({ kind: 'reportLevel', target: 100, worked: 9, allocated: 8 })).toBe('Low');
    expect(calculateEfficiency({ kind: 'reportLevel', target: 85, worked: 8, allocated: 8 })).toBe('At Par');
  });
});
