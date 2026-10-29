import { useMemo, useState } from "react";
import { cn } from "@heroui/theme";

import { Segmented } from "@/components/page";
import { Bullet, DeptMap, RankRow, Rules, Speedometer, type Bubble } from "./AdminOverview";
import { CountUp, LEVEL_STYLE, Reveal, levelOf, num, type Level } from "./parts";

const spaced = (name: string) => (name ?? "").replace(/([a-z])([A-Z])/g, "$1 $2");
const LEVELS: Level[] = ["High", "At Par", "Low"];
const longDay = (dt: Date) => dt.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long" });
const dayKey = (dt: Date) => `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
// The API sends a calendar date as UTC midnight; read its UTC parts so the day is the same in any time zone
const asDay = (v: unknown) => { const u = new Date(v as string); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()); };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Tone = "met" | "near" | "low" | "none" | "empty";
const toneOf = (target: number, hours: number): Tone => (hours <= 0 && target <= 0 ? "empty" : target >= 100 ? "met" : target >= 80 ? "near" : target > 0 ? "low" : "none");
const TONE: Record<Tone, { tile: string; label: string; dot: string }> = {
    met: { tile: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100", label: "Target met", dot: "bg-emerald-500" },
    near: { tile: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100", label: "80–99%", dot: "bg-amber-400" },
    low: { tile: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100", label: "Under 80%", dot: "bg-rose-500" },
    none: { tile: "border-ink-200 bg-white text-ink-800 dark:border-white/15 dark:bg-ink-900 dark:text-ink-100", label: "Worked, no target", dot: "bg-ink-400" },
    empty: { tile: "border-dashed border-ink-200 bg-transparent text-ink-400 dark:border-white/10", label: "No hours", dot: "border border-dashed border-ink-400" },
};

/** Your days as a calendar: one tile per working day, colored by target, click one for its numbers */
function DayCalendar({ days }: { days: any[] }) {
    const [pick, setPick] = useState<string | null>(null);

    const model = useMemo(() => {
        const rows = days.map((d) => ({ d, dt: asDay(d.WorkDate) })).filter((r) => !isNaN(+r.dt)).sort((a, b) => +a.dt - +b.dt);
        if (!rows.length) return null;
        const byKey = new Map(rows.map((r) => [dayKey(r.dt), r.d]));
        const first = rows[0]!.dt, last = rows[rows.length - 1]!.dt;
        const cols = rows.some((r) => r.dt.getDay() === 0 || r.dt.getDay() === 6) ? 7 : 5;
        const monday = new Date(first.getFullYear(), first.getMonth(), first.getDate() - ((first.getDay() + 6) % 7));
        const weeks: Date[][] = [];
        for (let w = new Date(monday); w <= last; w = new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7)) {
            weeks.push(Array.from({ length: cols }, (_, i) => new Date(w.getFullYear(), w.getMonth(), w.getDate() + i)));
        }
        const stat = (t: Tone) => rows.filter((r) => toneOf(num(r.d.TargetAchievedPercent), num(r.d.TotalTimeOfWork)) === t).length;
        return { byKey, first, last, cols, weeks, lastKey: dayKey(last), met: stat("met"), idle: stat("empty"), total: rows.length };
    }, [days]);

    if (!model) return null;
    const sel = model.byKey.get(pick ?? model.lastKey) ?? model.byKey.get(model.lastKey);
    const selDate = asDay(sel.WorkDate);
    const selLevel = LEVELS.find((l) => l === sel.EfficiencyLevel);
    const startOfFirst = new Date(model.first.getFullYear(), model.first.getMonth(), model.first.getDate());

    return (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_250px]">
            <div className="min-w-0">
                <p className="mb-3 text-xs text-ink-600 dark:text-ink-300">
                    Target met on <b className="text-ink-900 dark:text-white">{model.met}</b> of <b className="text-ink-900 dark:text-white">{model.total}</b> days
                    {model.idle > 0 && <> · <b className="text-ink-900 dark:text-white">{model.idle}</b> with no hours</>}
                </p>

                <div className="grid gap-1.5" style={{ gridTemplateColumns: `56px repeat(${model.cols}, minmax(0, 1fr))` }}>
                    <span />
                    {WEEKDAYS.slice(0, model.cols).map((w) => <span key={w} className="eyebrow pb-1 text-center">{w}</span>)}
                    {model.weeks.map((week, wi) => (
                        <div key={wi} className="contents">
                            <span className="self-center text-[10px] font-semibold uppercase tracking-wide text-ink-400">{week[0]!.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                            {week.map((dt) => {
                                const rec = model.byKey.get(dayKey(dt));
                                const outside = dt < startOfFirst || dt > model.last;
                                if (outside) return <span key={dayKey(dt)} aria-hidden />;
                                if (!rec) return <span key={dayKey(dt)} className="flex min-h-[58px] items-start p-1.5 text-[10px] text-ink-300 dark:text-ink-600" aria-label={`${longDay(dt)}: no entry`}>{dt.getDate()}</span>;
                                const target = Math.round(num(rec.TargetAchievedPercent)), hours = Math.round(num(rec.TotalTimeOfWork) * 10) / 10;
                                const tone = toneOf(target, hours);
                                const on = dayKey(dt) === dayKey(selDate);
                                return (
                                    <button key={dayKey(dt)} type="button" onClick={() => setPick(dayKey(dt))} aria-pressed={on} aria-label={`${longDay(dt)}: target ${target}%, ${hours} hours`}
                                        className={cn("relative flex min-h-[58px] flex-col justify-between border p-1.5 text-left transition-shadow focus-ring", TONE[tone].tile, on ? "shadow-[0_0_0_2px] shadow-brand-600" : "hover:shadow-md")}>
                                        <span className="text-[10px] font-semibold opacity-70">{dt.getDate()}{dt.getDate() === 1 ? ` ${dt.toLocaleDateString("en-GB", { month: "short" })}` : ""}</span>
                                        <span className="text-sm font-bold leading-none">{hours > 0 ? `${hours}h` : "–"}</span>
                                        <span className="text-[10px] font-semibold opacity-80">{target}%</span>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-500 dark:text-ink-400">
                    {(Object.keys(TONE) as Tone[]).map((t) => <span key={t} className="flex items-center gap-1.5"><span className={cn("h-2.5 w-2.5", TONE[t].dot)} aria-hidden />{TONE[t].label}</span>)}
                </div>
            </div>

            <aside className="self-start border border-ink-200 p-4 dark:border-white/10" aria-live="polite">
                <p className="eyebrow">Selected day</p>
                <p className="mt-1 text-sm font-bold text-ink-900 dark:text-white">{longDay(selDate)}</p>
                {selLevel && <span className={cn("mt-1.5 inline-block text-[11px] font-bold uppercase tracking-wide", LEVEL_STYLE[selLevel].text)}>{selLevel} efficiency</span>}
                <dl className="mt-4 space-y-3">
                    {([
                        ["Target achieved", `${Math.round(num(sel.TargetAchievedPercent))}%`, Math.min(100, num(sel.TargetAchievedPercent)), 100],
                        ["Utilization", `${Math.round(num(sel.UtilizationPercent))}%`, Math.min(100, num(sel.UtilizationPercent)), 100],
                        ["Hours worked", `${Math.round(num(sel.TotalTimeOfWork) * 10) / 10}h of ${num(sel.AllocatedTimeHrs).toFixed(1)}h`, num(sel.TotalTimeOfWork), Math.max(num(sel.AllocatedTimeHrs), 8)],
                    ] as [string, string, number, number][]).map(([label, text, v, max]) => (
                        <div key={label}>
                            <div className="flex items-baseline justify-between text-xs"><dt className="text-ink-500 dark:text-ink-400">{label}</dt><dd className="font-bold text-ink-900 dark:text-white">{text}</dd></div>
                            <div className="mt-1 h-1.5 bg-ink-100 dark:bg-white/10"><div className="h-full bg-brand-500" style={{ width: `${Math.min(100, (v / max) * 100)}%` }} /></div>
                        </div>
                    ))}
                </dl>
            </aside>
        </div>
    );
}

function Empty({ title, text, onWiden }: { title: string; text: string; onWiden: () => void }) {
    return (
        <Reveal className="flex flex-wrap items-center justify-between gap-4 border border-dashed border-ink-300 bg-white p-8 dark:border-white/20 dark:bg-ink-900">
            <div>
                <p className="text-sm font-bold text-ink-900 dark:text-white">{title}</p>
                <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{text}</p>
            </div>
            <button type="button" onClick={onWiden} className="h-9 bg-brand-600 px-4 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-700 focus-ring">Show last 90 days</button>
        </Reveal>
    );
}

// ── Executive / Functional Leader: the same overview as the company one, for the leader's own team ──
// `leader` is one leader from DashBoardAll (leader -> departments -> users), already rolled up by the API.
export function TeamOverview({ leader, loading, onWiden }: { leader: any | null; loading: boolean; onWiden: () => void }) {
    const [hover, setHover] = useState<number | null>(null);
    const [side, setSide] = useState<"top" | "attention" | "departments">("top");

    const departments: any[] = leader?.departments ?? [];

    // every person in the team, one bubble each
    const people: Bubble[] = useMemo(() => {
        const rows: Bubble[] = [];
        for (const d of departments) {
            for (const u of d.users ?? []) {
                const target = num(u.AvgTargetPercent);
                rows.push({ id: rows.length, name: u.UserName, users: 1, target, util: num(u.AvgUtilizationPercent), hours: num(u.AvgTotalWork), level: levelOf(target), sub: spaced(d.DepartmentName) });
            }
        }
        return rows;
    }, [departments]);

    const headcount = useMemo(() => new Set(departments.flatMap((d) => (d.users ?? []).map((u: any) => u.UserID))).size, [departments]);
    const counts = useMemo(() => people.reduce((c, p) => ({ ...c, [p.level]: c[p.level] + 1 }), { High: 0, "At Par": 0, Low: 0 } as Record<Level, number>), [people]);
    const top = useMemo(() => [...people].sort((a, b) => b.target - a.target).slice(0, 12), [people]);
    const attention = useMemo(() => [...people].sort((a, b) => a.target - b.target).slice(0, 12), [people]);
    const depts = useMemo(() => departments.map((d) => ({ id: d.DepartmentID as number, name: spaced(d.DepartmentName), target: num(d.AvgTargetPercent), util: num(d.AvgUtilizationPercent), hours: num(d.AvgTotalWork), people: (d.users ?? []).length as number })).sort((a, b) => b.target - a.target), [departments]);

    const name: string = leader?.ELName ?? leader?.FLName ?? "";
    const empty = !loading && people.length === 0;

    return (
        <div className="flex flex-col gap-3 lg:h-[calc(100vh-300px)] lg:min-h-[520px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="eyebrow">{name ? `${name}'s team` : "Your team"}</p>
                <div className="flex items-center gap-4 text-[11px] text-ink-500 dark:text-ink-400">
                    {loading && <span className="eyebrow animate-pulse">Updating…</span>}
                    {LEVELS.map((l) => <span key={l} className="flex items-center gap-1.5"><span className={cn("h-2 w-2", LEVEL_STYLE[l].bar)} aria-hidden />{l} <b className="text-ink-900 dark:text-white">{counts[l]}</b></span>)}
                </div>
            </div>

            {empty ? (
                <Empty title="No logged work in this date range" text="Nobody on your team has submitted entries between these dates. Pick another range above, or look at the last 90 days." onWiden={onWiden} />
            ) : (
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[290px_minmax(0,1fr)_330px]">
                    <Reveal className="flex min-h-0 flex-col justify-between gap-4 border border-ink-200 bg-white p-5 dark:border-white/10 dark:bg-ink-900">
                        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-900 dark:text-white">Team pulse</h2>
                        <Speedometer value={num(leader?.AvgTargetPercent)} />
                        <div className="space-y-3">
                            <Bullet label="Utilization" value={num(leader?.AvgUtilizationPercent)} max={120} marker={100} display={`${num(leader?.AvgUtilizationPercent).toFixed(1)}%`} tone="bg-ink-900 dark:bg-white" delay={0.3} />
                            <Bullet label="Allocated hours / day" value={num(leader?.AvgAllocatedHrs)} max={10} marker={8} display={`${num(leader?.AvgAllocatedHrs).toFixed(2)}h`} delay={0.4} />
                            <Bullet label="Worked hours / day" value={num(leader?.AvgTotalWork)} max={10} marker={num(leader?.AvgAllocatedHrs) || 8} display={`${num(leader?.AvgTotalWork).toFixed(2)}h`} tone={num(leader?.AvgTotalWork) > num(leader?.AvgAllocatedHrs) ? "bg-rose-500" : "bg-emerald-500"} delay={0.5} />
                        </div>
                        <dl className="grid grid-cols-2 gap-px border border-ink-200 bg-ink-200 dark:border-white/10 dark:bg-white/10">
                            <div className="bg-white px-3 py-2 dark:bg-ink-900"><dt className="eyebrow">People</dt><dd className="text-lg font-bold text-ink-900 dark:text-white"><CountUp value={headcount} /></dd></div>
                            <div className="bg-white px-3 py-2 dark:bg-ink-900"><dt className="eyebrow">Departments</dt><dd className="text-lg font-bold text-ink-900 dark:text-white"><CountUp value={departments.length} /></dd></div>
                        </dl>
                    </Reveal>

                    <Reveal index={1} className="flex min-h-[360px] min-w-0 flex-col border border-ink-200 bg-white p-5 dark:border-white/10 dark:bg-ink-900">
                        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                            <h2 className="text-xs font-bold uppercase tracking-wide text-ink-900 dark:text-white">Team map</h2>
                            <p className="text-[11px] text-ink-500 dark:text-ink-400">Each bubble is a person. Top-right is best.</p>
                        </div>
                        <div className="relative min-h-[300px] flex-1"><DeptMap items={people} hover={hover} onHover={setHover} /></div>
                    </Reveal>

                    <Reveal index={2} className="flex min-h-0 flex-col border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
                        <div className="border-b border-ink-200 p-3 dark:border-white/10">
                            <Segmented size="sm" label="Ranking" value={side} onChange={setSide} options={[{ key: "top", label: "Top" }, { key: "attention", label: "Needs help" }, { key: "departments", label: "Departments" }]} />
                        </div>
                        <ul key={side} className="min-h-[170px] flex-1 divide-y divide-ink-100 overflow-y-auto dark:divide-white/5">
                            {side === "departments"
                                ? depts.map((d, i) => <RankRow key={d.id} index={i} name={d.name} sub={`${d.people} ${d.people === 1 ? "person" : "people"} · util ${d.util.toFixed(0)}% · ${d.hours.toFixed(1)}h`} value={d.target} level={levelOf(d.target)} />)
                                : (side === "top" ? top : attention).map((p, i) => <RankRow key={p.id} index={i} name={p.name} sub={`${p.sub ?? ""} · util ${p.util.toFixed(0)}% · ${p.hours.toFixed(1)}h`} value={p.target} level={p.level} active={hover === p.id} onEnter={() => setHover(p.id)} />)}
                        </ul>
                        <Rules />
                    </Reveal>
                </div>
            )}
        </div>
    );
}

// ── Everyone else: the same overview, for the person's own numbers ──────────────────────────────
// `summary` is the person's averages for the range, `days` their day-by-day rows.
export function PersonalOverview({ summary, days, loading, onWiden }: { summary: { values: number[]; subtitle?: string }; days: any[]; loading: boolean; onWiden: () => void }) {
    const [target, util, allocated, worked] = [0, 1, 2, 3].map((i) => num(summary.values?.[i]));
    const level = (LEVELS.find((l) => l === summary.subtitle) ?? levelOf(target)) as Level;
    const empty = !loading && days.length === 0;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="eyebrow">Your numbers</p>
                {loading && <span className="eyebrow animate-pulse">Updating…</span>}
            </div>

            {empty ? (
                <Empty title="No logged days in this date range" text="Log your daily activity, or pick another range above. You can also look at the last 90 days." onWiden={onWiden} />
            ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[290px_minmax(0,1fr)]">
                    <Reveal className="flex flex-col gap-4 border border-ink-200 bg-white p-5 dark:border-white/10 dark:bg-ink-900">
                        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-900 dark:text-white">Your pulse</h2>
                        <Speedometer value={target} />
                        <div className="space-y-3">
                            <Bullet label="Utilization" value={util} max={120} marker={100} display={`${util.toFixed(1)}%`} tone="bg-ink-900 dark:bg-white" delay={0.3} />
                            <Bullet label="Allocated hours / day" value={allocated} max={10} marker={8} display={`${allocated.toFixed(2)}h`} delay={0.4} />
                            <Bullet label="Worked hours / day" value={worked} max={10} marker={allocated || 8} display={`${worked.toFixed(2)}h`} tone={worked > allocated ? "bg-rose-500" : "bg-emerald-500"} delay={0.5} />
                        </div>
                        <dl className="grid grid-cols-2 gap-px border border-ink-200 bg-ink-200 dark:border-white/10 dark:bg-white/10">
                            <div className="bg-white px-3 py-2 dark:bg-ink-900"><dt className="eyebrow">Efficiency</dt><dd className={cn("text-lg font-bold", LEVEL_STYLE[level].text)}>{level}</dd></div>
                            <div className="bg-white px-3 py-2 dark:bg-ink-900"><dt className="eyebrow">Days logged</dt><dd className="text-lg font-bold text-ink-900 dark:text-white"><CountUp value={days.length} /></dd></div>
                        </dl>
                    </Reveal>

                    <div className="flex min-w-0 flex-col gap-3">
                        <Reveal index={1} className="border border-ink-200 bg-white p-5 dark:border-white/10 dark:bg-ink-900">
                            <h2 className="text-xs font-bold uppercase tracking-wide text-ink-900 dark:text-white">Your days</h2>
                            <p className="mb-4 mt-1 text-[11px] text-ink-500 dark:text-ink-400">Every working day in this range. Click a day to see its numbers.</p>
                            <DayCalendar days={days} />
                        </Reveal>
                        <Reveal index={2} className="border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
                            <Rules />
                        </Reveal>
                    </div>
                </div>
            )}
        </div>
    );
}
