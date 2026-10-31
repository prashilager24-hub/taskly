/** Fixed + variable split. Every hike amount (expected, target, minimal, approved) goes through splitHike; nobody types the split. */
export type EmployeeLevel = 'ASSOCIATE' | 'MANAGER' | 'HEAD_EL';

export const VARIABLE_PCT: Record<EmployeeLevel, number> = { ASSOCIATE: 10, MANAGER: 20, HEAD_EL: 30 };

export const MAX_AMOUNT = 100_000_000;

export function splitHike(annualAmount: number, level: EmployeeLevel) {
  const pct = VARIABLE_PCT[level];
  const variable = Math.round((annualAmount * pct) / 100);
  return {
    annualAmount,
    fixed: annualAmount - variable,
    variable,
    variablePct: pct,
    variablePerHalfYear: variable / 2,
  };
}

// ── Dates: IST calendar days as 'YYYY-MM-DD' strings, so no time zone can move a day ──────────────

export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const toUtc = (d: string): Date => {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, day));
};
const fromUtc = (d: Date): string => d.toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Calendar months; a day that does not exist in the target month lands on its last day (31 Aug + 6 months = 28 Feb) */
export function addMonths(date: string, months: number): string {
  const d = toUtc(date);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), last));
  return fromUtc(target);
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Is `today` the joining anniversary? 29 Feb joiners are matched on 28 Feb in non-leap years. */
export function isAnniversary(joined: string, today: string): boolean {
  const [, jm, jd] = joined.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  if (jm === 2 && jd === 29 && !isLeap(ty)) return tm === 2 && td === 28;
  return jm === tm && jd === td;
}

/**
 * The four calendar quarters the appraisal looks back on: the last four that had ended by `ref`, oldest first.
 * The quarter `ref` falls in counts only when `ref` is its last day. n (1 to 4) is how a quarter is stored.
 */
export function quarterSlots(ref: string): { n: number; quarter: string; year: number }[] {
  const [y, m, d] = ref.split('-').map(Number) as [number, number, number];
  let q = Math.floor((m - 1) / 3);
  let year = y;
  const endMonth = q * 3 + 3;
  const lastDay = new Date(Date.UTC(y, endMonth, 0)).getUTCDate();
  if (!(m === endMonth && d === lastDay)) { q -= 1; if (q < 0) { q = 3; year -= 1; } }
  const out: { quarter: string; year: number }[] = [];
  for (let i = 0; i < 4; i++) {
    out.unshift({ quarter: `Q${q + 1}`, year });
    q -= 1;
    if (q < 0) { q = 3; year -= 1; }
  }
  return out.map((s, i) => ({ n: i + 1, ...s }));
}

// ── The April and October cycles ──────────────────────────────────────────────────────────────────
export type CycleMonth = 'APRIL' | 'OCTOBER';

/** Joined December to May: the April cycle. Joined June to November: the October cycle. */
export const cycleMonthOf = (joined: string): CycleMonth => {
  const m = Number(joined.slice(5, 7));
  return m >= 6 && m <= 11 ? 'OCTOBER' : 'APRIL';
};

/** The latest start of that cycle on or before `today`: 1 April or 1 October */
export function currentCycleStart(month: CycleMonth, today: string): string {
  const y = Number(today.slice(0, 4));
  const start = `${y}-${month === 'APRIL' ? '04' : '10'}-01`;
  return start <= today ? start : `${y - 1}${start.slice(4)}`;
}

/** The two windows of a cycle: employee days 1 to 15, assessors days 16 to 30 */
export function cycleWindows(start: string) {
  return { employeeWindowEnd: addDays(start, 14), assessorWindowEnd: addDays(start, 29) };
}
