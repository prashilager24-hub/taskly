import { useMemo, useState } from "react";
import { cn } from "@heroui/theme";

import { Segmented } from "@/components/page";
import DailyBars from "@/components/DailyBars";
import { Bullet, DeptMap, RankRow, Rules, Speedometer, type Bubble } from "./AdminOverview";
import { CountUp, LEVEL_STYLE, Reveal, levelOf, num, type Level } from "./parts";

const spaced = (name: string) => (name ?? "").replace(/([a-z])([A-Z])/g, "$1 $2");
const LEVELS: Level[] = ["High", "At Par", "Low"];
const day = (d: any) => new Date(d.WorkDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

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
                            <p className="mt-1 text-[11px] text-ink-500 dark:text-ink-400">Target achieved and hours worked for each working day in this range.</p>
                            <div className="mt-5 grid grid-cols-1 gap-8 2xl:grid-cols-2">
                                <div>
                                    <p className="eyebrow mb-3">Target achieved %</p>
                                    <DailyBars unit="%" goal={100} labels={days.map(day)} values={days.map((d) => Math.round(num(d.TargetAchievedPercent)))} />
                                </div>
                                <div>
                                    <p className="eyebrow mb-3">Hours worked</p>
                                    <DailyBars unit="h" goal={8} labels={days.map(day)} values={days.map((d) => Math.round(num(d.TotalTimeOfWork) * 10) / 10)} />
                                </div>
                            </div>
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
