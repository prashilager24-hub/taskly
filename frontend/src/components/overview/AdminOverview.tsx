import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@heroui/theme";

import { Segmented } from "@/components/page";
import { CountUp, LEVEL_STYLE, Meter, Reveal, levelOf, num, type Level } from "./parts";

export interface CompanyRaw { target: number; utilization: number; allocated: number; worked: number; goal: number | null; people: number; departments: number }

interface Dept { DepartmentID: number; DepartmentName: string; AvgTargetPercent: string | number; AvgUtilizationPercent: string | number; AvgTotalWork: string | number; TotalUsers: string | number }
interface Leader { ELID?: number; ELName?: string; FLID?: number; FLName?: string; AvgTargetPercent: string | number; AvgUtilizationPercent: string | number; TotalDepts: string | number }
type Scope = "all" | "business" | "support";

const spaced = (name: string) => name.replace(/([a-z])([A-Z])/g, "$1 $2");

// ── Speedometer: target achieved on a 0–120% dial, red / amber / green zones, animated needle ─────
const CX = 130, CY = 128, R = 104;
const polar = (deg: number, r = R) => [CX + r * Math.cos((deg * Math.PI) / 180), CY - r * Math.sin((deg * Math.PI) / 180)] as const;
const arc = (from: number, to: number, r = R) => {
    const [x1, y1] = polar(from, r), [x2, y2] = polar(to, r);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
};
const DIAL_MAX = 120;
const angleOf = (v: number) => 180 - (Math.min(Math.max(v, 0), DIAL_MAX) / DIAL_MAX) * 180;

export function Speedometer({ value }: { value: number }) {
    const reduce = useReducedMotion();
    const rot = 90 - angleOf(value); // needle drawn pointing up, rotated from there
    const zones: [number, number, string][] = [[0, 80, "#f43f5e"], [80, 100, "#f59e0b"], [100, 120, "#10b981"]];
    return (
        <div className="relative mx-auto w-full max-w-[280px]">
            <svg viewBox="0 0 260 150" className="w-full" role="img" aria-label={`Target achieved ${value.toFixed(1)} percent`}>
                {zones.map(([a, b, c]) => <path key={c} d={arc(angleOf(a), angleOf(b))} fill="none" stroke={c} strokeWidth="14" opacity="0.22" />)}
                {zones.map(([a, b, c], i) => (
                    <motion.path key={c + "v"} d={arc(angleOf(a), angleOf(b))} fill="none" stroke={c} strokeWidth="14"
                        initial={reduce ? false : { pathLength: 0 }}
                        animate={{ pathLength: value >= b ? 1 : value <= a ? 0 : (value - a) / (b - a) }}
                        transition={{ duration: 0.9, delay: 0.15 + i * 0.25, ease: "easeOut" }} />
                ))}
                {[0, 40, 80, 100, 120].map((t) => {
                    const [x, y] = polar(angleOf(t), R + 15);
                    return <text key={t} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-ink-400 text-[9px] font-semibold">{t}</text>;
                })}
                <motion.g initial={reduce ? false : { rotate: -90 }} animate={{ rotate: rot }} transition={{ type: "spring", stiffness: 60, damping: 14, delay: 0.3 }} style={{ transformOrigin: `${CX}px ${CY}px` }}>
                    <polygon points={`${CX - 4},${CY} ${CX + 4},${CY} ${CX},${CY - 84}`} className="fill-ink-900 dark:fill-white" />
                </motion.g>
                <circle cx={CX} cy={CY} r="9" className="fill-ink-900 dark:fill-white" />
                <circle cx={CX} cy={CY} r="3.5" className="fill-white dark:fill-ink-900" />
            </svg>
            <div className="-mt-1 text-center">
                <CountUp value={value} decimals={1} suffix="%" className="text-[34px] font-bold leading-none tracking-tight text-ink-900 dark:text-white" />
                <p className="eyebrow mt-1.5">Target achieved</p>
            </div>
        </div>
    );
}

/** A bar with a marker for where it should be, e.g. utilization against 100% */
export function Bullet({ label, value, max, marker, display, tone = "bg-brand-600", delay = 0 }: { label: string; value: number; max: number; marker?: number; display: string; tone?: string; delay?: number }) {
    return (
        <div>
            <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="text-ink-500 dark:text-ink-400">{label}</span>
                <span className="font-bold text-ink-900 dark:text-white">{display}</span>
            </div>
            <div className="relative">
                <Meter value={value} max={max} barClassName={tone} delay={delay} className="h-2" />
                {marker !== undefined && <span className="absolute -top-0.5 h-3 w-0.5 bg-ink-900 dark:bg-white" style={{ left: `${Math.min(100, (marker / max) * 100)}%` }} aria-hidden />}
            </div>
        </div>
    );
}

// ── Department map: every department as a bubble, utilization across, target up, size = people ────
export interface Bubble { id: number; name: string; users: number; target: number; util: number; hours: number; level: Level; sub?: string }

export function DeptMap({ items, hover, onHover }: { items: Bubble[]; hover: number | null; onHover: (id: number | null) => void }) {
    const reduce = useReducedMotion();
    const box = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ w: 640, h: 400 });
    useEffect(() => {
        const el = box.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => { const r = e!.contentRect; if (r.width > 50 && r.height > 50) setSize({ w: Math.round(r.width), h: Math.round(r.height) }); });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    const W = size.w, H = size.h, L = 46, B = 38, T = 12, Rr = 16;
    const yMax = Math.max(120, Math.ceil((Math.max(...items.map((i) => i.target), 0) + 10) / 20) * 20);
    const xMax = 110;
    const x = (v: number) => L + (Math.min(v, xMax) / xMax) * (W - L - Rr);
    const y = (v: number) => H - B - (Math.min(v, yMax) / yMax) * (H - B - T);
    const active = items.find((i) => i.id === hover) ?? null;
    return (
        <div ref={box} className="relative h-full min-h-0 w-full">
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0" role="img" aria-label="Departments by utilization and target achieved" onMouseLeave={() => onHover(null)}>
                {/* zones */}
                <rect x={x(80)} y={y(yMax)} width={x(xMax) - x(80)} height={y(100) - y(yMax)} className="fill-emerald-500/[0.07]" />
                <rect x={L} y={y(80)} width={x(xMax) - L} height={y(0) - y(80)} className="fill-rose-500/[0.05]" />
                {Array.from({ length: Math.floor(yMax / 20) + 1 }, (_, i) => i * 20).map((t) => (
                    <g key={t}>
                        <line x1={L} x2={W - Rr} y1={y(t)} y2={y(t)} className={t === 100 || t === 80 ? "stroke-ink-300 dark:stroke-white/25" : "stroke-ink-100 dark:stroke-white/10"} strokeDasharray={t === 100 || t === 80 ? "4 4" : undefined} />
                        <text x={L - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-ink-500 text-[11px] dark:fill-ink-400">{t}%</text>
                    </g>
                ))}
                {[0, 20, 40, 60, 80, 100].map((t) => <text key={t} x={x(t)} y={H - B + 16} textAnchor="middle" className="fill-ink-500 text-[11px] dark:fill-ink-400">{t}%</text>)}
                <text x={(L + W) / 2} y={H - 3} textAnchor="middle" className="fill-ink-500 text-[10px] font-bold uppercase tracking-widest">Utilization</text>
                <text transform={`translate(11 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" className="fill-ink-500 text-[10px] font-semibold uppercase tracking-widest">Target achieved</text>
                {items.map((d, i) => {
                    const r = Math.min(8 + Math.sqrt(d.users) * 3.2, 24);
                    const on = hover === d.id;
                    return (
                        <motion.circle key={d.id} cx={x(d.util)} cy={y(d.target)} fill={LEVEL_STYLE[d.level].hex}
                            fillOpacity={hover === null || on ? 0.78 : 0.22} stroke={LEVEL_STYLE[d.level].hex} strokeWidth={on ? 3 : 1.5}
                            initial={reduce ? false : { r: 0 }} animate={{ r: on ? r + 3 : r }}
                            transition={{ type: "spring", stiffness: 180, damping: 16, delay: on ? 0 : Math.min(i, 30) * 0.025 }}
                            onMouseEnter={() => onHover(d.id)} onFocus={() => onHover(d.id)} tabIndex={0} aria-label={`${d.name}: target ${d.target.toFixed(0)}%, utilization ${d.util.toFixed(0)}%`}
                            style={{ cursor: "pointer", outline: "none" }} />
                    );
                })}
            </svg>
            {active && (
                <div className="pointer-events-none absolute z-10 min-w-[170px] border border-ink-200 bg-white px-3 py-2 shadow-pop dark:border-white/15 dark:bg-ink-900"
                    style={{ left: Math.min(Math.max(x(active.util) - 85, 4), W - 180), top: Math.max(y(active.target) - 86, 4) }}>
                    <p className="text-xs font-bold text-ink-900 dark:text-white">{active.name}</p>
                    <p className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">{active.users} {active.users === 1 ? "person" : "people"} · {active.hours.toFixed(1)}h / day</p>
                    <p className="mt-1 text-[11px]"><span className={cn("font-bold", LEVEL_STYLE[active.level].text)}>{active.level}</span> · Target {active.target.toFixed(1)}% · Util {active.util.toFixed(1)}%</p>
                </div>
            )}
        </div>
    );
}

type Side = "top" | "attention" | "leaders";

/** One compact ranked row: name, a small bar, the number */
export function RankRow({ name, sub, value, level, active, onEnter, index }: { name: string; sub: string; value: number; level: Level; active?: boolean; onEnter?: () => void; index: number }) {
    return (
        <li onMouseEnter={onEnter} className={cn("grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-2.5 px-3 py-2 transition-colors", active ? "bg-ink-50 dark:bg-white/5" : "hover:bg-ink-50/70 dark:hover:bg-white/[0.03]")}>
            <span className="text-[11px] font-bold text-ink-400">{index + 1}</span>
            <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-ink-900 dark:text-white" title={name}>{name}</p>
                <div className="mt-1 flex items-center gap-2">
                    <Meter value={value} max={120} barClassName={LEVEL_STYLE[level].bar} className="h-1" delay={0.1 + index * 0.04} />
                </div>
                <p className="mt-0.5 truncate text-[10.5px] text-ink-500 dark:text-ink-400">{sub}</p>
            </div>
            <span className={cn("text-sm font-bold", LEVEL_STYLE[level].text)}>{value.toFixed(0)}%</span>
        </li>
    );
}

export const RULE = "border-l-4 border-amber-400 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-ink-800 dark:border-amber-500 dark:bg-amber-500/10 dark:text-ink-100";

export function Rules() {
    return (
        <section className="space-y-1 border-t border-ink-200 p-2.5 dark:border-white/10">
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-ink-900 dark:text-white">Efficiency &amp; Utilization Rules</h2>
            <div className={RULE}><b>Note:</b> Regular workday = 8 hours. Half day leave = 4 hours.</div>
            <div className={RULE}><b>Efficiency:</b> <span className="font-semibold text-emerald-600">High</span> target ≥ 100%, goal ≥ 80%, time ≤ allocated · <span className="font-semibold text-amber-600">At Par</span> target ≥ 80%, goal ≥ 50%, time ≤ allocated · <span className="font-semibold text-rose-600">Low</span> otherwise</div>
            <div className={RULE}><b>Utilization:</b> Time taken / standard time × 100 (capped at 100% when efficiency is Low)</div>
        </section>
    );
}

// The company view for Super Admin, built to fit one screen: pulse (left), department map (middle), ranked lists and the rules (right).
export default function AdminOverview({ company, departments, executiveLeaders, functionalLeaders, scope, onScope, loading, onWiden }: {
    company: CompanyRaw | null; departments: Dept[]; executiveLeaders: Leader[]; functionalLeaders: Leader[];
    scope: Scope; onScope: (s: Scope) => void; loading: boolean; rules?: ReactNode; onWiden: () => void;
}) {
    const [hover, setHover] = useState<number | null>(null);
    const [side, setSide] = useState<Side>("top");

    const items: Bubble[] = useMemo(() => departments.map((d) => {
        const target = num(d.AvgTargetPercent);
        return { id: d.DepartmentID, name: spaced(d.DepartmentName), users: num(d.TotalUsers), target, util: num(d.AvgUtilizationPercent), hours: num(d.AvgTotalWork), level: levelOf(target) };
    }), [departments]);

    const counts = useMemo(() => items.reduce((c, r) => ({ ...c, [r.level]: c[r.level] + 1 }), { High: 0, "At Par": 0, Low: 0 } as Record<Level, number>), [items]);
    const top = useMemo(() => [...items].sort((a, b) => b.target - a.target).slice(0, 12), [items]);
    const attention = useMemo(() => [...items].sort((a, b) => a.target - b.target).slice(0, 12), [items]);
    const leaders = useMemo(() => [...executiveLeaders].map((l) => ({ id: num(l.ELID), name: l.ELName ?? "Unknown", target: num(l.AvgTargetPercent), util: num(l.AvgUtilizationPercent), depts: num(l.TotalDepts) })).sort((a, b) => b.target - a.target), [executiveLeaders]);
    void functionalLeaders;

    const c = company;
    const empty = !loading && c && c.people === 0;

    return (
        <div className="flex flex-col gap-3 lg:h-[calc(100vh-300px)] lg:min-h-[520px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Segmented size="sm" label="Departments shown" value={scope} onChange={onScope}
                    options={[{ key: "all", label: "Whole company" }, { key: "business", label: "Business" }, { key: "support", label: "Support functions" }]} />
                <div className="flex items-center gap-4 text-[11px] text-ink-500 dark:text-ink-400">
                    {loading && <span className="eyebrow animate-pulse">Updating…</span>}
                    {(["High", "At Par", "Low"] as Level[]).map((l) => <span key={l} className="flex items-center gap-1.5"><span className={cn("h-2 w-2", LEVEL_STYLE[l].bar)} aria-hidden />{l} <b className="text-ink-900 dark:text-white">{counts[l]}</b></span>)}
                </div>
            </div>

            {empty ? (
                <Reveal className="flex flex-1 flex-wrap items-center justify-between gap-4 border border-dashed border-ink-300 bg-white p-8 dark:border-white/20 dark:bg-ink-900">
                    <div>
                        <p className="text-sm font-bold text-ink-900 dark:text-white">No logged work in this date range</p>
                        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Nobody has submitted entries between these dates. Pick another range above, or look at the last 90 days.</p>
                    </div>
                    <button type="button" onClick={onWiden} className="h-9 bg-brand-600 px-4 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-700 focus-ring">Show last 90 days</button>
                </Reveal>
            ) : (
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[290px_minmax(0,1fr)_330px]">
                    {/* Pulse */}
                    <Reveal className="flex min-h-0 flex-col justify-between gap-4 border border-ink-200 bg-white p-5 dark:border-white/10 dark:bg-ink-900">
                        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-900 dark:text-white">Company pulse</h2>
                        <Speedometer value={c?.target ?? 0} />
                        <div className="space-y-3">
                            <Bullet label="Utilization" value={c?.utilization ?? 0} max={120} marker={100} display={`${(c?.utilization ?? 0).toFixed(1)}%`} tone="bg-ink-900 dark:bg-white" delay={0.3} />
                            <Bullet label="Allocated hours / day" value={c?.allocated ?? 0} max={10} marker={8} display={`${(c?.allocated ?? 0).toFixed(2)}h`} delay={0.4} />
                            <Bullet label="Worked hours / day" value={c?.worked ?? 0} max={10} marker={c?.allocated ?? 8} display={`${(c?.worked ?? 0).toFixed(2)}h`} tone={c && c.worked > c.allocated ? "bg-rose-500" : "bg-emerald-500"} delay={0.5} />
                        </div>
                        <dl className="grid grid-cols-2 gap-px border border-ink-200 bg-ink-200 dark:border-white/10 dark:bg-white/10">
                            <div className="bg-white px-3 py-2 dark:bg-ink-900"><dt className="eyebrow">People</dt><dd className="text-lg font-bold text-ink-900 dark:text-white"><CountUp value={c?.people ?? 0} /></dd></div>
                            <div className="bg-white px-3 py-2 dark:bg-ink-900"><dt className="eyebrow">Departments</dt><dd className="text-lg font-bold text-ink-900 dark:text-white"><CountUp value={c?.departments ?? 0} /></dd></div>
                        </dl>
                    </Reveal>

                    {/* Map */}
                    <Reveal index={1} className="flex min-h-[360px] min-w-0 flex-col border border-ink-200 bg-white p-5 dark:border-white/10 dark:bg-ink-900">
                        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                            <h2 className="text-xs font-bold uppercase tracking-wide text-ink-900 dark:text-white">Department map</h2>
                            <p className="text-[11px] text-ink-500 dark:text-ink-400">Each bubble is a department. Bigger means more people. Top-right is best.</p>
                        </div>
                        <div className="relative min-h-[300px] flex-1"><DeptMap items={items} hover={hover} onHover={setHover} /></div>
                    </Reveal>

                    {/* Ranked lists + rules */}
                    <Reveal index={2} className="flex min-h-0 flex-col border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
                        <div className="border-b border-ink-200 p-3 dark:border-white/10">
                            <Segmented size="sm" label="Ranking" value={side} onChange={setSide} options={[{ key: "top", label: "Top" }, { key: "attention", label: "Needs help" }, { key: "leaders", label: "Leaders" }]} />
                        </div>
                        <ul key={side} className="min-h-[170px] flex-1 divide-y divide-ink-100 overflow-y-auto dark:divide-white/5">
                            {side === "leaders"
                                ? leaders.map((l, i) => <RankRow key={l.id} index={i} name={l.name} sub={`${l.depts} ${l.depts === 1 ? "department" : "departments"} · util ${l.util.toFixed(0)}%`} value={l.target} level={levelOf(l.target)} />)
                                : (side === "top" ? top : attention).map((d, i) => <RankRow key={d.id} index={i} name={d.name} sub={`${d.users} ${d.users === 1 ? "person" : "people"} · util ${d.util.toFixed(0)}% · ${d.hours.toFixed(1)}h`} value={d.target} level={d.level} active={hover === d.id} onEnter={() => setHover(d.id)} />)}
                        </ul>
                        <Rules />
                    </Reveal>
                </div>
            )}
        </div>
    );
}
