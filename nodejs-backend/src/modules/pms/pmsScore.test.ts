import { computePms, renderReason, renderHumanReason } from './pmsScore';
import assert from 'node:assert/strict';

const near = (a: number | null, b: number, msg: string) => assert.ok(a != null && Math.abs(a - b) < 0.001, `${msg}: got ${a}, want ${b}`);

// Values agreed in the PMS model sheet (Model X)
near(computePms({ goalPct: 0.83, targetPct: 0.25 }).score, 0.5791, 'Goal-led 83/25');
near(computePms({ goalPct: 1.0, targetPct: 0.423 }).score, 0.7725, 'Goal-led 100/42.3');
near(computePms({ goalPct: 1.0, targetPct: 0.2 }).score, 0.617, 'Scenario 3');
near(computePms({ goalPct: 0.1, targetPct: 2.0 }).score, 0.3873, 'Scenario 4 (Target capped at 150%)');
near(computePms({ goalPct: 0.3, targetPct: 0.7 }).score, 0.4583, 'Scenario 1 (Target-led, 50:50)');
near(computePms({ goalPct: 1.15, targetPct: 1.5 }).score, 1.3134, 'Scenario 7');
near(computePms({ goalPct: 0.65, targetPct: 0.65 }).score, 0.65, 'Equal values give the same %');

// No jump at the switch-over: just above and just below equality are almost the same
const a = computePms({ goalPct: 0.6501, targetPct: 0.65 }).score!;
const b = computePms({ goalPct: 0.6499, targetPct: 0.65 }).score!;
assert.ok(Math.abs(a - b) < 0.001, 'continuous at Goal = Target');

// Manager shift: +5% moves weight to Goal, -5% to Target, anything beyond is clamped
near(computePms({ goalPct: 1.0, targetPct: 0.423, managerShift: 0.05 }).score, 0.8065, 'shift +5% Goal-led');
near(computePms({ goalPct: 0.3, targetPct: 0.7, managerShift: -0.05 }).score, 0.4781, 'shift -5% Target-led (45:55)');
assert.equal(computePms({ goalPct: 0.5, targetPct: 0.6, managerShift: 0.2 }).managerShift, 0.05, 'shift clamped to 5%');

// Reason codes and flags
assert.equal(computePms({ goalPct: 1.1, targetPct: 1.05 }).reasonCode, 'EXCEEDED_BOTH');
assert.equal(computePms({ goalPct: 0.68, targetPct: 0.7 }).reasonCode, 'BALANCED');
assert.equal(computePms({ goalPct: 0.83, targetPct: 0.25 }).reasonCode, 'GOAL_LED');
assert.equal(computePms({ goalPct: 0.3, targetPct: 1.2 }).reasonCode, 'TARGET_LED');
assert.equal(computePms({ goalPct: null, targetPct: 0.5 }).reasonCode, 'NO_GOAL');
assert.equal(computePms({ goalPct: 0.5, targetPct: null }).score, null);
assert.deepEqual(computePms({ goalPct: 0.02, targetPct: 2 }).reasonFlags, ['FLOOR_APPLIED', 'CAP_APPLIED']);

// Nudge: for a Goal-led person, raising Target helps most
const r = computePms({ goalPct: 0.83, targetPct: 0.25 });
assert.equal(r.nudges[0].side, 'TARGET');
near(r.nudges[0].newScore, 0.6408, 'Target +10 nudge');

console.log(renderReason(r));
console.log(renderReason(computePms({ goalPct: 1.0, targetPct: 0.423, managerShift: 0.05 })));
// Tough period and human wording
assert.equal(computePms({ goalPct: 0.3, targetPct: 0.4 }).reasonCode, 'TOUGH_PERIOD');
const inp = { goalPct: 14 / 17, targetPct: 150 / 600, previousScore: 0.52, workingDays: 60,
  goalMetric: { name: 'Closures', unit: 'deals', planned: 17, achieved: 14 },
  targetMetric: { name: 'Calls', unit: 'calls', planned: 600, achieved: 150 } };
const h = renderHumanReason(computePms(inp), inp);
assert.match(h.heldBack!, /150 of 600 calls/);
assert.match(h.nextStep!, /About 60 more calls \(about 1 more a day\)/);
assert.match(h.trend!, /^Up \d+ points/);
console.log(h);
const tp = { goalPct: 0.3, targetPct: 0.4, goalMetric: { name: 'Margin', unit: 'margin (₹)', planned: 300000, achieved: 90000 } };
console.log(renderHumanReason(computePms(tp), tp));
console.log('All tests passed');
