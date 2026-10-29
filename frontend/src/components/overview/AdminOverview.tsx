import { useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Building2, Clock, Gauge as GaugeIcon, Search, Users } from "lucide-react";
import { cn } from "@heroui/theme";

import { Segmented } from "@/components/page";
import { CountUp, DualGauge, Kpi, LEVEL_STYLE, LevelDonut, Meter, Reveal, levelOf, num, type Level } from "./parts";

export interface CompanyRaw { target: number; utilization: number; allocated: number; worked: number; goal: number | null; people: number; departments: number }

interface Dept { DepartmentID: number; DepartmentName: string; AvgTargetPercent: string | number; AvgUtilizationPercent: string | number; AvgTotalWork: string | number; TotalUsers: string | number; AvgGoalEfficiency?: string | number }
interface Leader { ELID?: number; ELName?: string; FLID?: number; FLName?: string; AvgTargetPercent: string | number; AvgUtilizationPercent: string | number; TotalDepts: string | number; AvgGoalEfficiency?: string | number }

type Sort = "target" | "utilization" | "hours";
type Scope = "all" | "business" | "support";

const spaced = (name: string) => name.replace(/([a-z])([A-Z])/g, "$1 $2");

/** One department: rank, name, an animated bar for the chosen measure, and the other two numbers */
function DeptRow({ d, rank, sort, index }: { d: { name: string; users: number; target: number; util: number; hours: number; level: Level }; rank: number; sort: Sort; index: number }) {
    const reduce = useReducedMotion();
    const value = sort === "target" ? d.target : sort === "utilization" ? d.util : d.hours;
    const max = sort === "hours" ? 10 : 120;
    const pct = Math.max(2, Math.min(100, (value / max) * 100));
    return (
        <li className="group grid grid-cols-[28px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-1 py-2.5 transition-colors hover:bg-ink-50 dark:hover:bg-white/[0.03] sm:grid-cols-[28px_minmax(0,220px)_minmax(0,1fr)_auto]">
            <span className="text-xs font-bold text-ink-400">{rank}</span>
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900 dark:text-white" title={d.name}>{d.name}</p>
                <p className="text-[11px] text-ink-500 dark:text-ink-400">{d.users} {d.users === 1 ? "person" : "people"}</p>
            </div>
            <div className="col-start-2 sm:col-start-auto">
                <div className="relative h-3 bg-ink-100 dark:bg-white/10">
                    <motion.div
                        className={cn("h-full", LEVEL_STYLE[d.level].bar)}
                        initial={reduce ? false : { width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: Math.min(index, 12) * 0.04, ease: [0.16, 1, 0.3, 1] }}
                    />
                    {sort !== "hours" && <span className="absolute inset-y-[-3px] w-px bg-ink-900/40 dark:bg-white/50" style={{ left: `${(100 / max) * 100}%` }} aria-hidden title="100% line" />}
                </div>
            </div>
            <div className="col-start-2 flex items-baseline gap-4 text-right sm:col-start-auto sm:min-w-[210px] sm:justify-end">
                <span className="w-16 text-sm font-bold text-ink-900 dark:text-white">{sort === "hours" ? `${value.toFixed(1)}h` : `${value.toFixed(1)}%`}</span>
                <span className="hidden text-[11px] text-ink-500 dark:text-ink-400 sm:inline">{sort === "target" ? `Util ${d.util.toFixed(0)}%` : `Target ${d.target.toFixed(0)}%`} · {d.hours.toFixed(1)}h</span>
                <span className={cn("hidden w-14 text-[10px] font-bold uppercase tracking-wide sm:inline", LEVEL_STYLE[d.level].text)}>{d.level}</span>
            </div>
        </li>
    );
}

function LeaderCard({ name, depts, target, util, goal, index }: { name: string; depts: number; target: number; util: number; goal: number | null; index: number }) {
    const level = levelOf(target);
    return (
        <Reveal index={index} className="border border-ink-200 bg-white p-4 transition-colors hover:border-brand-500 dark:border-white/10 dark:bg-ink-900 dark:hover:border-brand-500/60">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-ink-900 text-[11px] font-bold text-white dark:bg-white/10">{name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</span>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900 dark:text-white" title={name}>{name}</p>
                        <p className="text-[11px] text-ink-500 dark:text-ink-400">{depts} {depts === 1 ? "department" : "departments"}</p>
                    </div>
                </div>
                <span className={cn("shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", LEVEL_STYLE[level].soft, LEVEL_STYLE[level].text)}>{level}</span>
            </div>
            <dl className="mt-4 space-y-2.5">
                {([["Target", target, LEVEL_STYLE[level].bar], ["Utilization", util, "bg-ink-900 dark:bg-white"]] as [string, number, string][]).map(([k, v, c], i) => (
                    <div key={k}>
                        <div className="flex justify-between text-xs"><dt className="text-ink-500 dark:text-ink-400">{k}</dt><dd className="font-bold text-ink-900 dark:text-white"><CountUp value={v} decimals={1} suffix="%" /></dd></div>
                        <Meter value={v} max={120} barClassName={c} delay={0.15 + index * 0.05 + i * 0.1} className="mt-1" />
                    </div>
                ))}
                {goal !== null && <div className="flex justify-between border-t border-ink-100 pt-2 text-xs dark:border-white/10"><dt className="text-ink-500 dark:text-ink-400">Goal efficiency</dt><dd className="font-bold text-ink-900 dark:text-white">{goal.toFixed(1)}%</dd></div>}
            </dl>
        </Reveal>
    );
}

// The company view for Super Admin: how the company is doing, which departments carry it, who leads them.
export default function AdminOverview({ company, departments, executiveLeaders, functionalLeaders, scope, onScope, loading, rules, onWiden }: {
    company: CompanyRaw | null; departments: Dept[]; executiveLeaders: Leader[]; functionalLeaders: Leader[];
    scope: Scope; onScope: (s: Scope) => void; loading: boolean; rules: ReactNode; onWiden: () => void;
}) {
    const [sort, setSort] = useState<Sort>("target");
    const [level, setLevel] = useState<Level | "All">("All");
    const [query, setQuery] = useState("");
    const [all, setAll] = useState(false);
    const [leaders, setLeaders] = useState<"el" | "fl">("el");

    const rows = useMemo(() => departments.map((d) => {
        const target = num(d.AvgTargetPercent);
        return { id: d.DepartmentID, name: spaced(d.DepartmentName), users: num(d.TotalUsers), target, util: num(d.AvgUtilizationPercent), hours: num(d.AvgTotalWork), level: levelOf(target) };
    }), [departments]);

    const counts = useMemo(() => rows.reduce((c, r) => ({ ...c, [r.level]: c[r.level] + 1 }), { High: 0, "At Par": 0, Low: 0 } as Record<Level, number>), [rows]);

    const sorted = useMemo(() => {
        const q = query.trim().toLowerCase();
        const key = sort === "target" ? "target" : sort === "utilization" ? "util" : "hours";
        return rows.filter((r) => (level === "All" || r.level === level) && (!q || r.name.toLowerCase().includes(q))).sort((a, b) => b[key] - a[key]);
    }, [rows, sort, level, query]);
    const visible = all || query || level !== "All" ? sorted : sorted.slice(0, 10);

    const list = leaders === "el" ? executiveLeaders : functionalLeaders;
    const leaderRows = list.map((l) => ({
        key: String(leaders === "el" ? l.ELID : l.FLID), name: (leaders === "el" ? l.ELName : l.FLName) ?? "Unknown",
        depts: num(l.TotalDepts), target: num(l.AvgTargetPercent), util: num(l.AvgUtilizationPercent),
        goal: l.AvgGoalEfficiency !== undefined && num(l.AvgGoalEfficiency) > 0 ? num(l.AvgGoalEfficiency) : null,
    })).sort((a, b) => b.target - a.target);

    const c = company;
    const companyLevel = c ? levelOf(c.target) : "Low";

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Segmented label="Departments shown" value={scope} onChange={onScope}
                    options={[{ key: "all", label: "Whole company" }, { key: "business", label: "Business" }, { key: "support", label: "Support functions" }]} />
                {loading && <span className="eyebrow animate-pulse">Updating…</span>}
            </div>

            {!loading && c && c.people === 0 && (
                <Reveal className="flex flex-wrap items-center justify-between gap-4 border border-dashed border-ink-300 bg-white p-6 dark:border-white/20 dark:bg-ink-900">
                    <div>
                        <p className="text-sm font-bold text-ink-900 dark:text-white">No logged work in this date range</p>
                        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Nobody has submitted entries between these dates. Pick another range above, or look at the last 90 days.</p>
                    </div>
                    <button type="button" onClick={onWiden} className="h-9 bg-brand-600 px-4 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-700 focus-ring">Show last 90 days</button>
                </Reveal>
            )}

            {/* Company pulse */}
            <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
                <Reveal className="border border-ink-200 bg-white p-6 dark:border-white/10 dark:bg-ink-900">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">Company pulse</h2>
                        {c && <span className={cn("px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", LEVEL_STYLE[companyLevel].soft, LEVEL_STYLE[companyLevel].text)}>{companyLevel}</span>}
                    </div>
                    <DualGauge outer={c?.target ?? 0} inner={c?.utilization ?? 0} outerLabel="Target achieved" innerLabel="Utilization" />
                </Reveal>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Kpi index={1} label="Utilization" value={c ? c.utilization : null} decimals={1} suffix="%" hint="Time worked against standard time" meter={c ? { value: c.utilization, max: 100 } : undefined} icon={<GaugeIcon size={16} />} />
                    <Kpi index={2} label="Allocated hours / day" value={c ? c.allocated : null} decimals={2} suffix="h" hint="Average per person, per working day" meter={c ? { value: c.allocated, max: 8 } : undefined} icon={<Clock size={16} />} />
                    <Kpi index={3} label="Worked hours / day" value={c ? c.worked : null} decimals={2} suffix="h" hint={c ? (c.worked <= c.allocated ? "Within allocated time" : "Above allocated time") : undefined} meter={c ? { value: c.worked, max: Math.max(c.allocated, c.worked, 1) } : undefined} icon={<Clock size={16} />} />
                    <Kpi index={4} label="People reporting" value={c ? c.people : null} hint={c ? <><CountUp value={c.departments} /> departments with logged work</> : undefined} icon={<Users size={16} />} />
                </div>
            </div>

            {/* Departments */}
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
                <Reveal index={3} className="border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-5 py-4 dark:border-white/10">
                        <div>
                            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">Departments</h2>
                            <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{sorted.length} of {rows.length} shown, ranked by {sort === "target" ? "target achieved" : sort === "utilization" ? "utilization" : "hours worked"}</p>
                        </div>
                        <Segmented size="sm" label="Rank by" value={sort} onChange={setSort} options={[{ key: "target", label: "Target" }, { key: "utilization", label: "Utilization" }, { key: "hours", label: "Hours" }]} />
                    </div>
                    <div className="border-b border-ink-100 px-5 py-3 dark:border-white/5">
                        <label className="relative block">
                            <span className="sr-only">Find a department</span>
                            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a department"
                                className="h-9 w-full border border-ink-200 bg-transparent pl-9 pr-3 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-500 dark:border-white/10 dark:text-white" />
                        </label>
                    </div>
                    <ul className="divide-y divide-ink-100 px-4 dark:divide-white/5">
                        {visible.map((r, i) => <DeptRow key={`${sort}-${r.id}`} d={r} rank={sorted.indexOf(r) + 1} sort={sort} index={i} />)}
                        {!visible.length && <li className="py-12 text-center text-sm text-ink-500">{loading ? "Loading…" : "No departments match."}</li>}
                    </ul>
                    {sorted.length > 10 && !query && level === "All" && (
                        <button type="button" onClick={() => setAll((v) => !v)} className="w-full border-t border-ink-100 py-3 text-xs font-bold uppercase tracking-wide text-brand-600 transition-colors hover:bg-ink-50 focus-ring dark:border-white/5 dark:hover:bg-white/5">
                            {all ? "Show top 10" : `Show all ${sorted.length}`}
                        </button>
                    )}
                </Reveal>

                <Reveal index={4} className="border border-ink-200 bg-white p-5 dark:border-white/10 dark:bg-ink-900">
                    <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">Efficiency mix</h2>
                    <p className="mb-5 text-xs text-ink-500 dark:text-ink-400">Pick a level to filter the list.</p>
                    <LevelDonut counts={counts} active={level} onPick={setLevel} />
                    <p className="mt-4 flex items-center gap-2 text-[11px] text-ink-500 dark:text-ink-400"><Building2 size={12} /> High 100%+, At Par 80%+ of target</p>
                </Reveal>
            </div>

            {/* Leaders */}
            {(executiveLeaders.length > 0 || functionalLeaders.length > 0) && (
                <section>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">Leaders</h2>
                        <Segmented size="sm" label="Leader type" value={leaders} onChange={setLeaders} options={[{ key: "el", label: `Executive (${executiveLeaders.length})` }, { key: "fl", label: `Functional (${functionalLeaders.length})` }]} />
                    </div>
                    <div key={leaders} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {leaderRows.map((l, i) => <LeaderCard key={l.key} index={Math.min(i, 8)} name={l.name} depts={l.depts} target={l.target} util={l.util} goal={l.goal} />)}
                        {!leaderRows.length && <p className="col-span-full border border-dashed border-ink-200 py-10 text-center text-sm text-ink-500 dark:border-white/10">No leaders to show for this selection.</p>}
                    </div>
                </section>
            )}

            {rules}
        </div>
    );
}
