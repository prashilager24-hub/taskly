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

/** The two windows of a cycle: employee days 1 to 15, assessors days 16 to 30 */
export function cycleWindows(start: string) {
  return { employeeWindowEnd: addDays(start, 14), assessorWindowEnd: addDays(start, 29) };
}
