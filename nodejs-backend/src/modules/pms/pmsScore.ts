/**
 * PMS score engine (Model X, Goal-led weighting) with manager weightage shift.
 *
 * Inputs are fractions: 0.83 means 83%.
 * Formula:
 *   g, t      = Goal % and Target %, each clamped to [floor, cap]
 *   goalLed   = g > t
 *   wGoal     = (goalLed ? 0.70 : 0.50) + managerShift      // managerShift in [-0.05, +0.05]
 *   score     = g^wGoal * t^(1 - wGoal)
 * When g == t the score equals g whatever the weights, so there is no jump when the formula switches.
 */

export type ReasonCode =
  | 'EXCEEDED_BOTH'
  | 'BALANCED'
  | 'GOAL_LED'
  | 'TARGET_LED'
  | 'TOUGH_PERIOD'
  | 'NO_GOAL'
  | 'NO_TARGET'
  | 'NO_DATA';

export type ReasonFlag = 'FLOOR_APPLIED' | 'CAP_APPLIED' | 'MANAGER_SHIFT_TO_GOAL' | 'MANAGER_SHIFT_TO_TARGET';

export interface PmsConfig {
  balancedGoalWeight: number; // Goal weight when Target >= Goal
  goalLedGoalWeight: number; // Goal weight when Goal > Target
  cap: number; // max credit per side
  floor: number; // min credit per side
  balancedBand: number; // gap treated as "level" in the reason text
  maxManagerShift: number; // manager may move up to this much weight between Goal and Target
  nudgeStep: number; // improvement used for "what would raise it"
  toughBelow: number; // both sides below this = TOUGH_PERIOD
  formulaVersion: string;
}

export const DEFAULT_CONFIG: PmsConfig = {
  balancedGoalWeight: 0.5,
  goalLedGoalWeight: 0.7,
  cap: 1.5,
  floor: 0.05,
  balancedBand: 0.05,
  maxManagerShift: 0.05,
  nudgeStep: 0.1,
  toughBelow: 0.5,
  formulaVersion: 'X-1.1',
};

/** The person's main metric on one side, used only to word the reason in their own units. */
export interface MetricDetail {
  name: string; // e.g. 'Closures', 'Calls'
  unit: string; // plural noun, e.g. 'deals', 'calls'
  planned: number; // e.g. 600
  achieved: number; // e.g. 150
}

export interface PmsInput {
  goalPct: number | null; // averaged Goal achievement for the period, or null if no goal data
  targetPct: number | null; // averaged Target achievement for the period, or null if no target data
  managerShift?: number; // + moves weight from Target to Goal, - moves weight from Goal to Target
  goalMetric?: MetricDetail; // main Goal metric (optional, for human wording)
  targetMetric?: MetricDetail; // main Target metric (optional, for human wording)
  previousScore?: number | null; // last period's score, for the trend line
  workingDays?: number; // working days in the period, to turn a next step into "per day"
}

export interface Nudge {
  side: 'GOAL' | 'TARGET';
  from: number;
  to: number;
  newScore: number;
}

export interface PmsResult {
  score: number | null; // final PMS score (fraction)
  scoreWithoutShift: number | null; // same calculation with no manager shift, for transparency
  goalPct: number | null; // raw inputs
  targetPct: number | null;
  goalCredited: number | null; // after floor and cap, what the bars should show
  targetCredited: number | null;
  goalWeight: number | null; // weights actually used
  targetWeight: number | null;
  managerShift: number; // after clamping to the allowed range
  reasonCode: ReasonCode;
  reasonFlags: ReasonFlag[];
  nudges: Nudge[]; // best improvement first
  formulaVersion: string;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

function scoreOf(goal: number, target: number, shift: number, cfg: PmsConfig) {
  const g = clamp(goal, cfg.floor, cfg.cap);
  const t = clamp(target, cfg.floor, cfg.cap);
  const base = g > t ? cfg.goalLedGoalWeight : cfg.balancedGoalWeight;
  const wGoal = base + shift;
  return { g, t, wGoal, score: Math.pow(g, wGoal) * Math.pow(t, 1 - wGoal) };
}

export function computePms(input: PmsInput, cfg: PmsConfig = DEFAULT_CONFIG): PmsResult {
  const shift = clamp(input.managerShift ?? 0, -cfg.maxManagerShift, cfg.maxManagerShift);
  const { goalPct, targetPct } = input;
  const empty: PmsResult = {
    score: null,
    scoreWithoutShift: null,
    goalPct,
    targetPct,
    goalCredited: goalPct == null ? null : clamp(goalPct, cfg.floor, cfg.cap),
    targetCredited: targetPct == null ? null : clamp(targetPct, cfg.floor, cfg.cap),
    goalWeight: null,
    targetWeight: null,
    managerShift: shift,
    reasonCode: 'NO_DATA',
    reasonFlags: [],
    nudges: [],
    formulaVersion: cfg.formulaVersion,
  };
  if (goalPct == null && targetPct == null) return empty;
  if (goalPct == null) return { ...empty, reasonCode: 'NO_GOAL' };
  if (targetPct == null) return { ...empty, reasonCode: 'NO_TARGET' };

  const main = scoreOf(goalPct, targetPct, shift, cfg);
  const noShift = scoreOf(goalPct, targetPct, 0, cfg);

  let reasonCode: ReasonCode;
  if (goalPct >= 1 && targetPct >= 1) reasonCode = 'EXCEEDED_BOTH';
  else if (goalPct < cfg.toughBelow && targetPct < cfg.toughBelow) reasonCode = 'TOUGH_PERIOD';
  else if (Math.abs(goalPct - targetPct) <= cfg.balancedBand) reasonCode = 'BALANCED';
  else reasonCode = goalPct > targetPct ? 'GOAL_LED' : 'TARGET_LED';

  const flags: ReasonFlag[] = [];
  if (goalPct < cfg.floor || targetPct < cfg.floor) flags.push('FLOOR_APPLIED');
  if (goalPct > cfg.cap || targetPct > cfg.cap) flags.push('CAP_APPLIED');
  if (shift > 0) flags.push('MANAGER_SHIFT_TO_GOAL');
  if (shift < 0) flags.push('MANAGER_SHIFT_TO_TARGET');

  const nudges: Nudge[] = [];
  if (goalPct < cfg.cap) {
    const to = Math.min(goalPct + cfg.nudgeStep, cfg.cap);
    nudges.push({ side: 'GOAL', from: goalPct, to, newScore: scoreOf(to, targetPct, shift, cfg).score });
  }
  if (targetPct < cfg.cap) {
    const to = Math.min(targetPct + cfg.nudgeStep, cfg.cap);
    nudges.push({ side: 'TARGET', from: targetPct, to, newScore: scoreOf(goalPct, to, shift, cfg).score });
  }
  nudges.sort((a, b) => b.newScore - a.newScore);

  return {
    score: main.score,
    scoreWithoutShift: noShift.score,
    goalPct,
    targetPct,
    goalCredited: main.g,
    targetCredited: main.t,
    goalWeight: main.wGoal,
    targetWeight: 1 - main.wGoal,
    managerShift: shift,
    reasonCode,
    reasonFlags: flags,
    nudges,
    formulaVersion: cfg.formulaVersion,
  };
}

/* ---------------- Reason text (render at display time, never store the sentence) ---------------- */

const pct = (x: number | null) => (x == null ? '-' : `${Math.round(x * 100)}%`);
const pct1 = (x: number | null) => (x == null ? '-' : `${(x * 100).toFixed(1)}%`);

const REASON_TEMPLATES: Record<ReasonCode, (r: PmsResult) => string> = {
  EXCEEDED_BOTH: (r) =>
    `You beat both your Goal (${pct(r.goalPct)}) and your Target (${pct(r.targetPct)}), so your score is above 100%.`,
  BALANCED: (r) =>
    `Your Goal (${pct(r.goalPct)}) and Target (${pct(r.targetPct)}) are level, so your score sits right between them.`,
  GOAL_LED: (r) =>
    `You delivered ${pct(r.goalPct)} of your Goal, the main part of your role, so it counts for more. Your Target (${pct(r.targetPct)}) is what is holding your score back.`,
  TARGET_LED: (r) =>
    `You hit ${pct(r.targetPct)} of your Target, but your Goal is ${pct(r.goalPct)}. Extra Target can't make up for a low Goal, so your Goal is what is holding your score back.`,
  TOUGH_PERIOD: (r) =>
    `Your Goal (${pct(r.goalPct)}) and Target (${pct(r.targetPct)}) were both below half this period, so your score is ${pct1(r.score)}.`,
  NO_GOAL: () => `Your Goal results aren't recorded for this period, so a combined score can't be given. Check with your manager.`,
  NO_TARGET: () => `Your Target results aren't recorded for this period, so a combined score can't be given. Check with your manager.`,
  NO_DATA: () => `No Goal or Target results are recorded for this period yet.`,
};

const FLAG_TEMPLATES: Record<ReasonFlag, (r: PmsResult, cfg: PmsConfig) => string> = {
  FLOOR_APPLIED: (_r, cfg) => `Anything below ${pct(cfg.floor)} is counted as ${pct(cfg.floor)}.`,
  CAP_APPLIED: (_r, cfg) => `Anything above ${pct(cfg.cap)} is counted as ${pct(cfg.cap)}.`,
  MANAGER_SHIFT_TO_GOAL: (r) =>
    `Your manager moved ${pct(Math.abs(r.managerShift))} of weight from Target to Goal for this year (score without the change: ${pct1(r.scoreWithoutShift)}).`,
  MANAGER_SHIFT_TO_TARGET: (r) =>
    `Your manager moved ${pct(Math.abs(r.managerShift))} of weight from Goal to Target for this year (score without the change: ${pct1(r.scoreWithoutShift)}).`,
};

export function renderReason(r: PmsResult, cfg: PmsConfig = DEFAULT_CONFIG) {
  const why = [REASON_TEMPLATES[r.reasonCode](r), ...r.reasonFlags.map((f) => FLAG_TEMPLATES[f](r, cfg))].join(' ');
  const raise = r.nudges.map(
    (n) => `${n.side === 'GOAL' ? 'Goal' : 'Target'} ${pct(n.from)} → ${pct(n.to)}: score ≈ ${pct1(n.newScore)}`,
  );
  return { why, raise };
}

/* ---------------- Human reason: what went well, what held it back, your next step ---------------- */

export interface HumanReason {
  wentWell: string | null;
  heldBack: string | null;
  nextStep: string | null;
  trend: string | null;
}

const num = (x: number) => (Math.abs(x) >= 100 ? Math.round(x).toLocaleString('en-IN') : String(Math.round(x * 10) / 10));

/** Extra units needed to lift one side by cfg.nudgeStep, worded with a per-day figure when workingDays is known. */
function unitsFor(m: MetricDetail | undefined, cfg: PmsConfig, days?: number): string | null {
  if (!m || !(m.planned > 0)) return null;
  const n = Math.ceil(m.planned * cfg.nudgeStep);
  const perDay = days && days > 0 ? n / days : null;
  const daily = perDay == null ? '' : perDay >= 1 ? ` (about ${num(perDay)} more a day)` : ` (about ${Math.ceil(n / (days! / 5))} more a week)`;
  return `about ${num(n)} more ${m.unit}${daily}`;
}

const lbl = (m: MetricDetail | undefined, fallback: string) => (m ? m.name : fallback);
const done = (m: MetricDetail | undefined, p: number | null) =>
  m ? `${num(m.achieved)} of ${num(m.planned)} ${m.unit} (${pct(p)})` : pct(p);

export function renderHumanReason(r: PmsResult, input: PmsInput, cfg: PmsConfig = DEFAULT_CONFIG): HumanReason {
  const gm = input.goalMetric, tm = input.targetMetric;
  const G = lbl(gm, 'Goal'), T = lbl(tm, 'Target');
  const days = input.workingDays;
  const nudge = (side: 'GOAL' | 'TARGET') => r.nudges.find((n) => n.side === side);

  let trend: string | null = null;
  if (r.score != null && input.previousScore != null) {
    const d = Math.round((r.score - input.previousScore) * 100);
    trend = d === 0 ? 'Same as last period.' : `${d > 0 ? 'Up' : 'Down'} ${Math.abs(d)} point${Math.abs(d) === 1 ? '' : 's'} since last period.`;
  }

  switch (r.reasonCode) {
    case 'EXCEEDED_BOTH':
      return {
        wentWell: `Brilliant period. You went past your ${G} goal, ${done(gm, r.goalPct)}, and your ${T} target too, ${done(tm, r.targetPct)}.`,
        heldBack: null,
        nextStep: `Keep this pace. Anything above 100% counts, up to ${pct(cfg.cap)}.`,
        trend,
      };
    case 'GOAL_LED': {
      const n = nudge('TARGET');
      return {
        wentWell: `You delivered where it matters most. On ${G}, you reached ${done(gm, r.goalPct)}.`,
        heldBack: `On ${T}, you are at ${done(tm, r.targetPct)}. Because results and the work behind them both count, that gap is what is holding your score at ${pct1(r.score)}.`,
        nextStep: n ? `${cap1(unitsFor(tm, cfg, days) ?? `about ${pct(cfg.nudgeStep)} more ${T}`)} would take your score to roughly ${pct1(n.newScore)}.` : null,
        trend,
      };
    }
    case 'TARGET_LED': {
      const n = nudge('GOAL');
      return {
        wentWell: `You have put in the effort. On ${T}, you reached ${done(tm, r.targetPct)}.`,
        heldBack: `It has not turned into results yet. On ${G}, you are at ${done(gm, r.goalPct)}. Results count for more, so this is what is limiting your score.`,
        nextStep: n ? `${cap1(unitsFor(gm, cfg, days) ?? `about ${pct(cfg.nudgeStep)} more ${G}`)} would lift your score to roughly ${pct1(n.newScore)}.` : null,
        trend,
      };
    }
    case 'BALANCED': {
      const both = computePms({ goalPct: r.goalPct! + cfg.nudgeStep, targetPct: r.targetPct! + cfg.nudgeStep, managerShift: r.managerShift }, cfg).score;
      const g = unitsFor(gm, cfg), t = unitsFor(tm, cfg);
      return {
        wentWell: `Your results were steady: ${pct(r.goalPct)} on ${G} and ${pct(r.targetPct)} on ${T}.`,
        heldBack: `Because they are level, your score sits right between them at ${pct1(r.score)}.`,
        nextStep: `Push both together${g && t ? `: ${g} and ${t}` : ''}. That would take you to about ${pct1(both)}.`,
        trend,
      };
    }
    case 'TOUGH_PERIOD': {
      const weakIsGoal = (r.goalPct ?? 0) <= (r.targetPct ?? 0);
      const u = weakIsGoal ? unitsFor(gm, cfg, days) : unitsFor(tm, cfg, days);
      return {
        wentWell: `This was a hard period, and the numbers show it.`,
        heldBack: `${G} reached ${done(gm, r.goalPct)}, and ${T} reached ${done(tm, r.targetPct)}.`,
        nextStep: `Start with one thing: ${u ?? `lifting your ${weakIsGoal ? G : T}`}. Your manager will help you plan it.`,
        trend,
      };
    }
    case 'NO_GOAL':
    case 'NO_TARGET':
    case 'NO_DATA': {
      const what = r.reasonCode === 'NO_GOAL' ? `${G} results` : r.reasonCode === 'NO_TARGET' ? `${T} results` : 'results';
      return { wentWell: null, heldBack: `We don't have your ${what} for this period yet.`, nextStep: `Check your entries, or ask your manager to confirm them.`, trend: null };
    }
  }
}

const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
