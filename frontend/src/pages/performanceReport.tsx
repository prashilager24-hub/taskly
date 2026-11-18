import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

import { PageTitle } from "@/components/page";
import { Autocomplete, AutocompleteItem, Button, Card, Checkbox, Pagination, Select, SelectItem, Spinner } from "@/components/ui";
import { ChevronDown } from "lucide-react";
import DateRangeField from "@/components/DateRangeField";

/**
 * Dashboard → Performance Report. Whole company first; picking a department, sub department or person narrows it.
 * All figures come from the server (/performance-report), worked out the way old Taskly does for one person and
 * averaged person → sub department → department → company above that.
 */
const BASE = "/t2.0/authentificationUtilization/performance-report";

type Grain = "day" | "month" | "quarter" | "year";
interface Options { departments: { id: number; name: string }[]; subDepartments: { id: number; name: string; departmentId: number }[]; people: { id: number; name: string; subDepartmentId: number }[]; allCompany: boolean }
interface Cards { avgTargetPct: number | null; avgGoalPct: number | null; avgWorkingHrs: number | null; avgAllocatedHrs: number | null; dayRows: number; dayRowsBeforeExclude: number; targetEntries: number; daysWithTarget: number; goalEntries: number; weightedTarget: Weighted; weightedGoal: Weighted; people: number }
interface TargetRow { id: number; date: string; period: string; userId: number; associate: string; subDepartment: string; department: string; targetName: string; frequency: string | null; expected: number | null; achieved: number | null; pct: number | null; days: number; allocatedHrs: number | null; takenHrs: number | null; remarks: string }
interface GoalRow { id: number; date: string; period: string; userId: number; associate: string; subDepartment: string; department: string; goalName: string; frequency: string | null; expected: number | null; achieved: number | null; pct: number | null; entries: number; remarks: string }
interface GoalBreakdown { value: number | null; quarters: { quarter: string; value: number; months: { month: string; value: number; goals: { name: string; pct: number; entries: number }[] }[] }[] }
interface QuarterRow { quarter: string; partial: boolean; target: number | null; goal: number | null; targetEntries: number; goalEntries: number }
interface Weighted { pct: number | null; sum: number | null; entries: number }
interface Report { level: "person" | "sub" | "dept" | "company"; goalBreakdown: GoalBreakdown | null; quarters: QuarterRow[]; cards: Cards; charts: { target: { period: string; value: number }[]; goal: { period: string; value: number }[] }; targetTable: TargetRow[]; goalTable: GoalRow[] }

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();
const FIRST_YEAR = 2025;
const PERIODS = [["all", "All quarters"], ["Q1", "Q1 (Jan – Mar)"], ["Q2", "Q2 (Apr – Jun)"], ["Q3", "Q3 (Jul – Sep)"], ["Q4", "Q4 (Oct – Dec)"], ["custom", "Custom"]] as const;
const ALL_Q = [1, 2, 3, 4];

/** The dates from the first to the last chosen quarter (quarters in between that are not chosen are left out by the report) */
function rangeOfQuarters(qs: number[], y: number): [string, string] {
    const m1 = (Math.min(...qs) - 1) * 3 + 1, m3 = Math.max(...qs) * 3;
    return [`${y}-${pad(m1)}-01`, `${y}-${pad(m3)}-${lastDay(y, m3)}`];
}
const periodLabel = (k: string, g: Grain) => (g === "day" ? `${k.slice(8)} ${MON[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}` : g === "year" ? k : g === "month" ? `${MON[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}` : `${k.slice(5)} ${k.slice(0, 4)}`);
const hm = (v: number | null) => { if (v == null) return "—"; const m = Math.round(v * 60); return `${Math.floor(m / 60)}:${pad(m % 60)}`; };
const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(2)}%`);
const num = (v: number | null) => (v == null ? "—" : Math.abs(v) >= 1000 ? v.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : String(Number(v.toFixed(2))));
const fmtDate = (d: string) => `${d.slice(8)} ${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

function PctChip({ v }: { v: number | null }) {
    if (v == null) return <span className="text-ink-400">—</span>;
    const tone = v >= 100 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : v >= 75 ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : v > 0 ? "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" : "bg-ink-100 text-ink-500 dark:bg-white/5 dark:text-ink-400";
    return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${tone}`}>{v.toFixed(2)}%</span>;
}

/** Bars per period on a 0 – max scale with a dashed 100% line; hover a bar for its value */
function BarChart({ points, grain, empty }: { points: { period: string; value: number }[]; grain: Grain; empty: string }) {
    if (!points.length) return <p className="py-10 text-center text-sm text-ink-400">{empty}</p>;
    const W = 640, H = 240, L = 40, R = 12, T = 14, B = 34, iw = W - L - R, ih = H - T - B;
    const max = Math.max(120, ...points.map((p) => p.value)); const stepY = max > 200 ? 50 : 25;
    const y = (v: number) => T + ih - (v / max) * ih; const step = iw / points.length; const x = (i: number) => L + step * i + step / 2;
    const bw = Math.min(44, step * 0.6); const every = Math.ceil(points.length / 12);
    const ticks: number[] = []; for (let t = 0; t <= max; t += stepY) ticks.push(t);
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Bar chart by period">
            {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="stroke-ink-100 dark:stroke-white/10" /><text x={L - 6} y={y(t) + 4} fontSize="10" textAnchor="end" className="fill-ink-400">{t}</text></g>)}
            <line x1={L} x2={W - R} y1={y(100)} y2={y(100)} strokeDasharray="4 3" className="stroke-ink-400" />
            <text x={W - R} y={y(100) - 4} fontSize="10" textAnchor="end" className="fill-ink-500">100%</text>
            {points.map((p, i) => (
                <g key={p.period}>
                    <rect x={x(i) - bw / 2} y={y(p.value)} width={bw} height={Math.max(0, T + ih - y(p.value))} rx="3" className="fill-brand-600"><title>{`${periodLabel(p.period, grain)}: ${p.value.toFixed(2)}%`}</title></rect>
                    {points.length <= 12 && <text x={x(i)} y={y(p.value) - 4} fontSize="10" textAnchor="middle" className="fill-ink-900 dark:fill-white">{p.value.toFixed(2)}</text>}
                    {i % every === 0 && <text x={x(i)} y={H - 12} fontSize="10" textAnchor="middle" className="fill-ink-500">{grain === "day" ? periodLabel(p.period, grain).slice(0, 6) : periodLabel(p.period, grain)}</text>}
                </g>
            ))}
        </svg>
    );
}

/** Combined score goal weight the page opens with (management's 70 % goal / 30 % target) */
const DEFAULT_GOAL_W = 70;

/** The % against 100%: fills to 100, then shows how far over it is */
function Meter({ v, weighted }: { v: number | null; weighted: boolean }) {
    const w = v == null ? 0 : Math.max(0, Math.min(v, 100));
    return (
        <div className="mt-3 flex items-center gap-2" aria-hidden="true">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-white/10">
                <div className={`h-full rounded-full ${weighted ? "bg-brand-600" : "bg-ink-900 dark:bg-white"}`} style={{ width: `${w}%` }} />
            </div>
            <span className="w-14 text-right text-[10px] font-semibold tabular-nums text-ink-500">{v == null ? "" : v >= 100 ? `+${(v - 100).toFixed(2)}` : `of 100`}</span>
        </div>
    );
}

/** A card's calculation: hidden until "View calculation" is clicked */
function CalcToggle({ id, open, onToggle, children }: { id: string; open: Set<string>; onToggle: (id: string) => void; children: React.ReactNode }) {
    const shown = open.has(id);
    return (
        <div className="mt-1">
            <button type="button" onClick={() => onToggle(id)} aria-expanded={shown}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 focus-ring dark:text-brand-400">
                {shown ? "Hide calculation" : "View calculation"}
                <ChevronDown size={13} className={`transition-transform ${shown ? "rotate-180" : ""}`} />
            </button>
            {shown && <div className="mt-1 space-y-0.5 text-xs tabular-nums text-ink-500">{children}</div>}
        </div>
    );
}

type Col<T> ={ key: keyof T & string; label: string; num?: boolean; render?: (r: T) => React.ReactNode; csv?: (r: T) => string | number };
function DataTable<T extends object>({ title, note, cols, rows, csvName, empty }: { title: string; note: string; cols: Col<T>[]; rows: T[]; csvName: string; empty: string }) {
    const [sort, setSort] = useState<{ k: string; d: 1 | -1 }>({ k: "period", d: 1 });
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState<string>("25"); // 25 / 50 / 100 / all
    useEffect(() => setPage(1), [rows, perPage]);
    const sorted = useMemo(() => [...rows].sort((a, b) => {
        const x = (a as Record<string, unknown>)[sort.k], z = (b as Record<string, unknown>)[sort.k];
        if (x == null) return 1; if (z == null) return -1;
        return (typeof x === "number" && typeof z === "number" ? x - z : String(x).localeCompare(String(z))) * sort.d;
    }), [rows, sort]);
    const PER = perPage === "all" ? Math.max(sorted.length, 1) : Number(perPage);
    const pages = Math.max(1, Math.ceil(sorted.length / PER));
    const download = () => {
        const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const text = [cols.map((c) => esc(c.label)).join(","), ...sorted.map((r) => cols.map((c) => esc(c.csv ? c.csv(r) : (r as Record<string, unknown>)[c.key])).join(","))].join("\n");
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = csvName; a.click(); URL.revokeObjectURL(a.href);
    };
    return (
        <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center gap-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">{title}</h2>
                <span className="text-xs text-ink-500">{note}</span>
                <Button size="sm" variant="bordered" className="ml-auto" onPress={download} isDisabled={!rows.length}>Download CSV</Button>
            </div>
            <div className="max-h-[560px] overflow-auto border border-ink-200 dark:border-white/10">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-ink-50 dark:bg-ink-800">
                        <tr>{cols.map((c) => (
                            <th key={c.key} className={`cursor-pointer select-none whitespace-nowrap px-3 py-2.5 ${c.num ? "text-right" : "text-left"}`} onClick={() => setSort((s) => ({ k: c.key, d: s.k === c.key ? (s.d === 1 ? -1 : 1) : 1 }))}>
                                {c.label}{sort.k === c.key ? <span className="ml-1 text-brand-600">{sort.d === 1 ? "▲" : "▼"}</span> : null}
                            </th>))}</tr>
                    </thead>
                    <tbody>
                        {sorted.length ? sorted.slice((page - 1) * PER, page * PER).map((r, i) => (
                            <tr key={i} className="border-t border-ink-100 align-top hover:bg-brand-50/40 dark:border-white/5 dark:hover:bg-white/5">
                                {cols.map((c) => <td key={c.key} className={`px-3 py-2 ${c.num ? "whitespace-nowrap text-right tabular-nums" : c.key === "remarks" ? "min-w-[220px] max-w-[360px] whitespace-normal text-ink-600 dark:text-ink-300" : "whitespace-nowrap"}`}>{c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "—")}</td>)}
                            </tr>
                        )) : <tr><td colSpan={cols.length} className="px-3 py-10 text-center text-ink-400">{empty}</td></tr>}
                    </tbody>
                </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-sm font-bold text-ink-900 dark:text-white">
                    {sorted.length ? `Showing ${(page - 1) * PER + 1}–${Math.min(page * PER, sorted.length)} of ${sorted.length.toLocaleString("en-IN")} rows` : "0 rows"}
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink-900 dark:text-white">Rows per page</span>
                    <Select aria-label="Rows per page" size="sm" className="w-24" selectedKeys={new Set([perPage])} disallowEmptySelection onSelectionChange={(k) => setPerPage(String(Array.from(k)[0]))}>
                        {["25", "50", "100", "all"].map((v) => <SelectItem key={v}>{v === "all" ? "All" : v}</SelectItem>)}
                    </Select>
                </div>
                {pages > 1 && <Pagination className="ml-auto" total={pages} page={page} onChange={setPage} size="sm" />}
            </div>
        </Card>
    );
}

export default function PerformanceReport() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [qs, setQs] = useState<number[]>(ALL_Q);   // chosen quarters of the year
    const [custom, setCustom] = useState(false);     // From / To typed by hand
    const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
    const [to, setTo] = useState(`${now.getFullYear()}-12-31`);
    const [dept, setDept] = useState<string>("");
    const [sub, setSub] = useState<string>("");
    const [person, setPerson] = useState<string>("");
    const [grain, setGrain] = useState<Grain>("quarter");
    const [excludeZero, setExcludeZero] = useState(false);
    const [showMore, setShowMore] = useState(false); // hours + combined score cards
    // cards whose calculation is shown (hidden by default; "View calculation" on each card)
    const [openCalc, setOpenCalc] = useState<Set<string>>(new Set());
    // combined score weights, typed by the viewer: goal % and target %, kept adding up to 100
    // (typing one sets the other to what is left of 100)
    const [weights, setWeights] = useState<{ g: string; t: string }>({ g: String(DEFAULT_GOAL_W), t: String(100 - DEFAULT_GOAL_W) });
    const setWeight = (k: "g" | "t", v: string) => {
        if (v !== "" && Number.isNaN(Number(v))) return;
        const n = v === "" ? null : Math.min(100, Math.max(0, Math.round(Number(v))));
        const mine = n == null ? "" : String(n), other = n == null ? "" : String(100 - n);
        setWeights(k === "g" ? { g: mine, t: other } : { g: other, t: mine });
    };
    const toggleCalc =(id: string) => setOpenCalc((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const [options, setOptions] = useState<Options | null>(null);
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const years = useMemo(() => { const out: number[] = []; for (let y = Math.max(now.getFullYear(), FIRST_YEAR); y >= FIRST_YEAR; y--) out.push(y); return out; }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const pickQuarters = (list: number[], y = year) => { const q = [...new Set(list)].sort(); setQs(q); setCustom(false); const r = rangeOfQuarters(q, y); setFrom(r[0]); setTo(r[1]); };
    const periodKeys = custom ? new Set(["custom"]) : new Set([...(qs.length === 4 ? ["all"] : []), ...qs.map((q) => `Q${q}`)]);
    // Period is a multi-select: tick any quarters (Q1 + Q3 …); "All quarters" ticks all four; "Custom" uses the From / To dates
    const onPeriod = (keys: Set<string>) => {
        const added = [...keys].filter((k) => !periodKeys.has(k)), removed = [...periodKeys].filter((k) => !keys.has(k));
        if (added.includes("custom")) { setCustom(true); return; }
        if (added.includes("all")) { pickQuarters(ALL_Q); return; }
        if (removed.includes("all") && !added.length) { const q = qs.filter((x) => keys.has(`Q${x}`)); pickQuarters(q.length < 4 ? q : [Math.ceil((now.getMonth() + 1) / 3)]); return; }
        const base = custom ? [] : qs;
        const next = [...base.filter((q) => !removed.includes(`Q${q}`)), ...added.filter((k) => k[0] === "Q").map((k) => Number(k[1]))];
        if (next.length) pickQuarters(next);
    };
    const periodText = custom ? "Custom dates" : qs.length === 4 ? "All quarters" : qs.map((q) => `Q${q}`).join(" + ");

    // filter lists for the date range (only what the viewer may see)
    useEffect(() => {
        if (!from || !to || from > to) return;
        axios.get(`${BASE}/options`, { params: { from, to } }).then((r) => setOptions(r.data?.response ?? r.data?.data ?? r.data)).catch(() => setOptions(null));
    }, [from, to]);

    const subs = useMemo(() => (options?.subDepartments ?? []).filter((s) => dept === "" || String(s.departmentId) === dept), [options, dept]);
    const people = useMemo(() => {
        const ok = new Set(subs.map((s) => s.id));
        const m = new Map<number, string>();
        for (const p of options?.people ?? []) if ((sub ? String(p.subDepartmentId) === sub : ok.has(p.subDepartmentId))) m.set(p.id, p.name);
        return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [options, subs, sub]);
    // drop a choice that is no longer in its list
    useEffect(() => { if (sub && !subs.some((s) => String(s.id) === sub)) setSub(""); }, [subs, sub]);
    useEffect(() => { if (person && !people.some((p) => String(p.id) === person)) setPerson(""); }, [people, person]);

    const load = useCallback(() => {
        if (!from || !to) return;
        if (from > to) { setError("The start date must be on or before the end date."); return; }
        setLoading(true); setError("");
        axios.post(BASE, { from, to, quarters: custom || qs.length === 4 ? null : qs, departmentId: dept === "" ? null : Number(dept), subDepartmentId: sub ? Number(sub) : null, userId: person ? Number(person) : null, grain, excludeZero })
            .then((r) => setReport(r.data?.response ?? r.data?.data ?? r.data))
            .catch((e) => { setReport(null); setError(e?.response?.data?.message ?? "Could not load the report. Please try again."); })
            .finally(() => setLoading(false));
    }, [from, to, qs, custom, dept, sub, person, grain, excludeZero]);
    useEffect(() => { load(); }, [load]);

    const reset = () => { setDept(""); setSub(""); setPerson(""); setGrain("quarter"); setExcludeZero(false); setYear(now.getFullYear()); pickQuarters(ALL_Q, now.getFullYear()); };

    const scopeName = person ? people.find((p) => String(p.id) === person)?.name : sub ? subs.find((s) => String(s.id) === sub)?.name : dept !== "" ? options?.departments.find((d) => String(d.id) === dept)?.name : options && !options.allCompany ? "You and your team" : "All company";
    const c = report?.cards;
    const sel = (v: string) => (v === "" ? new Set<string>(["__all"]) : new Set([v]));
    const val = (k: unknown) => { const v = String(Array.from(k as Set<string>)[0] ?? "__all"); return v === "__all" ? "" : v; };

    const tCols: Col<TargetRow>[] = [
        { key: "period", label: "Period", render: (r) => periodLabel(r.period, grain), csv: (r) => periodLabel(r.period, grain) },
        { key: "date", label: "Date", render: (r) => periodLabel(r.date, "day"), csv: (r) => r.date },
        { key: "department", label: "Department" },
        { key: "subDepartment", label: "Sub Department" },
        { key: "associate", label: "Associate" },
        { key: "targetName", label: "Target Name" },
        { key: "days", label: "Days", num: true },
        { key: "expected", label: "Target Expected Unit", num: true, render: (r) => num(r.expected) },
        { key: "achieved", label: "Target Achieved Unit", num: true, render: (r) => num(r.achieved) },
        { key: "pct", label: "% Achieved", num: true, render: (r) => <PctChip v={r.pct} /> },
        { key: "allocatedHrs", label: "Allocated Time", num: true, render: (r) => hm(r.allocatedHrs), csv: (r) => hm(r.allocatedHrs) },
        { key: "takenHrs", label: "Time Taken", num: true, render: (r) => hm(r.takenHrs), csv: (r) => hm(r.takenHrs) },
        { key: "frequency", label: "Target Frequency" },
        { key: "remarks", label: "Remarks", render: (r) => r.remarks ? <span className="line-clamp-2" title={r.remarks}>{r.remarks}</span> : <span className="text-ink-400">—</span> },
    ];
    const gCols: Col<GoalRow>[] = [
        { key: "period", label: "Period", render: (r) => periodLabel(r.period, grain), csv: (r) => periodLabel(r.period, grain) },
        { key: "date", label: "Date", render: (r) => periodLabel(r.date, "day"), csv: (r) => r.date },
        { key: "department", label: "Department" },
        { key: "subDepartment", label: "Sub Department" },
        { key: "associate", label: "Associate" },
        { key: "goalName", label: "Goal Name" },
        { key: "expected", label: "Goal Expected Unit", num: true, render: (r) => num(r.expected) },
        { key: "achieved", label: "Goal Achieved Unit", num: true, render: (r) => num(r.achieved) },
        { key: "pct", label: "% Achieved", num: true, render: (r) => <PctChip v={r.pct} /> },
        { key: "frequency", label: "Goal Frequency" },
        { key: "remarks", label: "Remarks / Comments", render: (r) => r.remarks ? <span className="line-clamp-2" title={r.remarks}>{r.remarks}</span> : <span className="text-ink-400">—</span> },
    ];

    // ── cards ──
    const quartersUsed = report?.quarters ?? [];
    const qName = (q: QuarterRow) => `Q${q.quarter.slice(6)}${q.partial ? " (part)" : ""}`;
    const spanYears = [...new Set(quartersUsed.map((q) => q.quarter.slice(0, 4)))];
    const span = quartersUsed.length ? `${quartersUsed.map(qName).join(", ")} ${spanYears.join(" – ")}` : "no quarters with data";
    // average: each quarter counts the same
    const avgLine = (k: "target" | "goal") => {
        const used = quartersUsed.filter((q) => q[k] != null);
        const avg = k === "goal" ? c?.avgGoalPct ?? null : c?.avgTargetPct ?? null;
        const label = k === "goal" ? "Goal %" : "Target %";
        if (!used.length || avg == null) return `${label}: no data in these quarters`;
        return used.length === 1 ? `${label} = ${qName(used[0]!)} ${used[0]![k]!.toFixed(2)}` : `${label} = (${used.map((q) => `${qName(q)} ${q[k]!.toFixed(2)}`).join(" + ")}) / ${used.length} = ${avg.toFixed(2)}`;
    };
    // weighted: each quarter's % × its number of entries, summed, ÷ the number of entries
    const weightedOf = (k: "target" | "goal") => (k === "goal" ? c?.weightedGoal : c?.weightedTarget);
    const wLine = (k: "target" | "goal") => {
        const w = weightedOf(k); const label = k === "goal" ? "Weighted goal %" : "Weighted target %";
        return w && w.pct != null ? `${label} = ${(w.sum ?? 0).toFixed(2)} ÷ ${w.entries} entries = ${w.pct.toFixed(2)}` : `${label}: no data in these quarters`;
    };
    const wWorking = (k: "target" | "goal"): string[] => {
        const w = weightedOf(k); const n = k === "goal" ? "goalEntries" : "targetEntries";
        if (!w || w.pct == null) return [`No ${k} entries in these quarters`];
        const used = quartersUsed.filter((q) => q[k] != null && q[n] > 0);
        return [`(${used.map((q) => `${qName(q)} ${q[k]!.toFixed(2)} × ${q[n]}`).join(" + ")}) ÷ ${w.entries}`, `= ${(w.sum ?? 0).toFixed(2)} ÷ ${w.entries} ${k} entries = ${w.pct.toFixed(2)}%`];
    };
    const avgWorking = (k: "target" | "goal"): string[] => {
        const count = k === "goal" ? c?.goalEntries ?? 0 : c?.targetEntries ?? 0;
        return [avgLine(k), `${count} ${k} ${count === 1 ? "entry" : "entries"}, each quarter counts the same`];
    };
    // the 4 cards always shown
    const qCount = (k: "target" | "goal") => quartersUsed.filter((q) => q[k] != null).length;
    const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
    const entriesText = (n: number) => `${n.toLocaleString("en-IN")} ${n === 1 ? "entry" : "entries"}`;
    const mainCards = [
        { title: "Weighted Average % of Target Achieved", v: c?.weightedTarget?.pct ?? null, meta: c ? `${entriesText(c.weightedTarget?.entries ?? 0)} · ${plural(qCount("target"), "quarter")}` : "", lines: c ? wWorking("target") : [], weighted: true },
        { title: "Weighted Average % of Goal Achieved", v: c?.weightedGoal?.pct ?? null, meta: c ? `${entriesText(c.weightedGoal?.entries ?? 0)} · ${plural(qCount("goal"), "quarter")}` : "", lines: c ? wWorking("goal") : [], weighted: true },
        { title: "Avg % of Target Achieved", v: c?.avgTargetPct ?? null, meta: c ? `${plural(qCount("target"), "quarter")}, each counts the same` : "", lines: c ? avgWorking("target") : [], weighted: false },
        { title: "Avg % of Goal Achieved", v: c?.avgGoalPct ?? null, meta: c ? `${plural(qCount("goal"), "quarter")}, each counts the same` : "", lines: c ? avgWorking("goal") : [], weighted: false },
    ];
    // the 6 cards behind "More detailed calculated performance": hours + the 4 combined scores
    // combined scores: rows = how the goal / target % is averaged, columns = the weights
    const comboRows = [
        { key: "w", label: "Weighted", note: "each quarter counts by its entries", g: c?.weightedGoal?.pct ?? null, t: c?.weightedTarget?.pct ?? null, gl: wLine("goal"), tl: wLine("target"), weighted: true },
        { key: "avg", label: "Average", note: "each quarter counts the same", g: c?.avgGoalPct ?? null, t: c?.avgTargetPct ?? null, gl: avgLine("goal"), tl: avgLine("target"), weighted: false },
    ];
    // an empty box counts as 0 and the other box as the rest of 100
    // an empty box counts as 0 % goal
    const goalPct = weights.g !== "" ? Number(weights.g) : weights.t !== "" ? 100 - Number(weights.t) : 0;
    const wg = goalPct / 100, wt = (100 - goalPct) / 100;
    const combine = (wg: number, wt: number, g: number | null, t: number | null) => (g != null && t != null ? Math.round((wg * g + wt * t) * 100) / 100 : null);
    // date field presets: the chosen year and its quarters, plus the usual recent ranges
    const datePresets = useMemo(() => {
        const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const t = new Date(), back = (days: number) => { const d = new Date(t); d.setDate(d.getDate() - days); return iso(d); };
        return [
            { name: `Year ${year}`, start: `${year}-01-01`, end: `${year}-12-31` },
            ...ALL_Q.map((q) => { const r = rangeOfQuarters([q], year); return { name: `Q${q} ${year}`, start: r[0], end: r[1] }; }),
            { name: "This month", start: iso(new Date(t.getFullYear(), t.getMonth(), 1)), end: iso(t) },
            { name: "Last month", start: iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), end: iso(new Date(t.getFullYear(), t.getMonth(), 0)) },
            { name: "Last 30 days", start: back(29), end: iso(t) },
        ];
    }, [year]);

    return (
        <section className="flex flex-col gap-5">
            <PageTitle title="Performance Report" subtitle={`${scopeName ?? "All company"} · ${custom || qs.length === 4 ? "" : `${periodText} ${year} · `}${fmtDate(from)} – ${fmtDate(to)}${c && c.people > 1 ? ` · ${c.people} people` : ""}`} />

            <Card className="p-5">
                <div className="mb-3 flex items-center gap-3">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">Filters</h2>
                    <Button size="sm" variant="light" className="ml-auto" onPress={reset}>Reset</Button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Select label="Department" size="sm" selectedKeys={sel(dept)} disallowEmptySelection onSelectionChange={(k) => { setDept(val(k)); setSub(""); setPerson(""); }}>
                        {[{ id: "__all", name: options && !options.allCompany ? "All my departments" : "All departments" }, ...(options?.departments ?? []).map((d) => ({ id: String(d.id), name: d.name }))].map((d) => <SelectItem key={d.id}>{d.name}</SelectItem>)}
                    </Select>
                    <Select label="Sub Department" size="sm" selectedKeys={sel(sub)} disallowEmptySelection onSelectionChange={(k) => { setSub(val(k)); setPerson(""); }}>
                        {[{ id: "__all", name: "All sub departments" }, ...subs.map((s) => ({ id: String(s.id), name: s.name }))].map((s) => <SelectItem key={s.id}>{s.name}</SelectItem>)}
                    </Select>
                    <Autocomplete key={`${dept}-${sub}-${people.length}`} label="Associate" size="sm" placeholder="All associates — type a name" selectedKey={person || null} onSelectionChange={(k) => setPerson(k == null ? "" : String(k))} defaultItems={people.map((p) => ({ id: String(p.id), name: p.name }))}>
                        {(p: { id: string; name: string }) => <AutocompleteItem key={p.id}>{p.name}</AutocompleteItem>}
                    </Autocomplete>
                    <Select label="Year" size="sm" selectedKeys={new Set([String(year)])} disallowEmptySelection onSelectionChange={(k) => { const y = Number(Array.from(k)[0]); setYear(y); pickQuarters(custom ? ALL_Q : qs, y); }}>
                        {years.map((y) => <SelectItem key={String(y)}>{String(y)}</SelectItem>)}
                    </Select>
                    <Select label="View by" size="sm" selectedKeys={new Set([grain])} disallowEmptySelection onSelectionChange={(k) => setGrain(String(Array.from(k)[0]) as Grain)}>
                        <SelectItem key="day">Day</SelectItem>
                        <SelectItem key="month">Month</SelectItem>
                        <SelectItem key="quarter">Quarter</SelectItem>
                        <SelectItem key="year">Year</SelectItem>
                    </Select>
                    <Select label="Period" size="sm" selectionMode="multiple" selectedKeys={periodKeys} disallowEmptySelection renderValue={() => periodText} onSelectionChange={(k) => onPeriod(new Set(Array.from(k as Set<string>).map(String)))}>
                        {PERIODS.map(([k, l]) => <SelectItem key={k}>{l}</SelectItem>)}
                    </Select>
                    <div className="sm:col-span-2">
                        <DateRangeField fieldLabel="Dates" maxToday={false} presets={datePresets} value={{ start: from, end: to }} onChange={(r) => { setFrom(r.start); setTo(r.end); setCustom(true); }} />
                    </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                    <Checkbox size="sm" isSelected={excludeZero} onValueChange={setExcludeZero}>Exclude days with no target set (0%)</Checkbox>
                    {loading && <span className="flex items-center gap-2 text-xs text-ink-500"><Spinner size="sm" /> Loading…</span>}
                    {error && <span className="text-sm text-rose-600">{error}</span>}
                </div>
            </Card>

            {/* the 4 headline cards: same height, numbers on one line, calculation behind a link */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {mainCards.map((k) => (
                    <Card key={k.title} className={`flex h-full flex-col border-t-[3px] p-5 ${k.weighted ? "border-t-brand-600" : "border-t-ink-900 dark:border-t-white"}`}>
                        <div className="flex items-start justify-between gap-2">
                            <p className="eyebrow line-clamp-2 min-h-[2.6em] leading-snug">{k.title}</p>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${k.weighted ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "bg-ink-100 text-ink-600 dark:bg-white/10 dark:text-ink-300"}`}>{k.weighted ? "Weighted" : "Average"}</span>
                        </div>
                        <p className="mt-2 text-3xl font-extrabold tabular-nums leading-none text-ink-900 dark:text-white">{pct(k.v)}</p>
                        <p className="mt-1.5 min-h-[1.25rem] text-xs text-ink-500">{k.meta}</p>
                        <Meter v={k.v} weighted={k.weighted} />
                        <div className="mt-auto pt-3">
                            {k.lines.length > 0 && (
                                <CalcToggle id={k.title} open={openCalc} onToggle={toggleCalc}>
                                    {k.lines.map((l, i) => <p key={i} className={i === 0 ? "" : "font-semibold text-ink-700 dark:text-ink-200"}>{l}</p>)}
                                </CalcToggle>
                            )}
                        </div>
                    </Card>
                ))}
            </div>

            {/* hours and the combined scores, shown on request */}
            <div className="flex items-center gap-3">
                <Button size="sm" variant="bordered" onPress={() => setShowMore((v) => !v)} aria-expanded={showMore}
                    endContent={<ChevronDown size={15} className={`transition-transform ${showMore ? "rotate-180" : ""}`} />}>
                    {showMore ? "Hide detailed calculated performance" : "More detailed calculated performance"}
                </Button>
                {!showMore && <span className="text-xs text-ink-500">Working and allocated hours, and the combined score (goal % and target % weights you can change)</span>}
            </div>
            {showMore && (
                <Card className="p-5">
                    <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">Detailed calculated performance</h2>
                        <span className="text-xs text-ink-500">{span}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-3">
                        {/* combined score first: the weights on one line, then the Weighted and Average scores side by side */}
                        <div className="flex flex-col lg:col-span-2">
                            <div className="mb-3 flex min-h-8 flex-wrap items-center gap-x-4 gap-y-2">
                                <p className="eyebrow">Combined score</p>
                                <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-700 dark:text-ink-200">
                                    {(["g", "t"] as const).map((k) => (
                                        <span key={k} className="flex items-center gap-1.5">
                                            {k === "t" && <span className="px-0.5 text-ink-400">+</span>}
                                            <input type="number" min={0} max={100} step={1} inputMode="numeric" aria-label={`${k === "g" ? "Goal" : "Target"} weight`}
                                                value={weights[k]} onChange={(e) => setWeight(k, e.target.value)}
                                                className="h-8 w-16 border border-ink-200 bg-white px-2 text-right text-sm font-semibold tabular-nums text-ink-900 focus:border-brand-500 focus:outline-none dark:border-white/10 dark:bg-ink-900 dark:text-white" />
                                            <span>% {k === "g" ? "goal" : "target"}</span>
                                        </span>
                                    ))}
                                    {goalPct !== DEFAULT_GOAL_W && (
                                        <button type="button" onClick={() => setWeight("g", String(DEFAULT_GOAL_W))} className="ml-2 text-[11px] font-semibold text-brand-600 hover:text-brand-700 focus-ring">Reset to {DEFAULT_GOAL_W} / {100 - DEFAULT_GOAL_W}</button>
                                    )}
                                </div>
                            </div>
                            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                                {comboRows.map((r) => {
                                    const score = combine(wg, wt, r.g, r.t);
                                    return (
                                        <div key={r.key} className={`h-full border-l-[3px] border-y border-r border-y-ink-200 border-r-ink-200 bg-white p-4 dark:border-y-white/10 dark:border-r-white/10 dark:bg-ink-900 ${r.weighted ? "border-l-brand-600" : "border-l-ink-900 dark:border-l-white"}`}>
                                            <div className="flex min-h-[22px] flex-wrap items-center gap-2">
                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${r.weighted ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "bg-ink-100 text-ink-600 dark:bg-white/10 dark:text-ink-300"}`}>{r.label}</span>
                                                <span className="text-[11px] text-ink-500">{r.note}</span>
                                            </div>
                                            <p className="mt-2 text-2xl font-extrabold tabular-nums leading-none text-ink-900 dark:text-white">{pct(score)}</p>
                                            <div className="mt-2">
                                                <CalcToggle id={`combo-${r.key}`} open={openCalc} onToggle={toggleCalc}>
                                                    <p>{r.gl}</p>
                                                    <p>{r.tl}</p>
                                                    <p className="font-semibold text-ink-700 dark:text-ink-200">{score != null ? `${goalPct}% × ${r.g!.toFixed(2)} + ${100 - goalPct}% × ${r.t!.toFixed(2)} = ${score.toFixed(2)}%` : "Needs both a goal % and a target % in these quarters"}</p>
                                                </CalcToggle>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        {/* hours, after the combined score */}
                        <div className="flex flex-col">
                            <div className="mb-3 flex min-h-8 items-center"><p className="eyebrow">Hours per day</p></div>
                            <div className="grid flex-1 grid-cols-2 gap-3">
                                {([["Avg Working Hours", hm(c?.avgWorkingHrs ?? null), "h:mm worked per day: the average of the day rows"], ["Avg Allocated Hours", hm(c?.avgAllocatedHrs ?? null), "h:mm allocated per day: the average of the day rows"]] as const).map(([k, v, sub]) => (
                                    <div key={k} className="h-full border-l-[3px] border-y border-r border-l-ink-300 border-y-ink-200 border-r-ink-200 bg-white p-4 dark:border-l-white/30 dark:border-y-white/10 dark:border-r-white/10 dark:bg-ink-900">
                                        <div className="flex min-h-[22px] items-center"><p className="eyebrow leading-snug">{k}</p></div>
                                        <p className="mt-2 text-2xl font-extrabold tabular-nums leading-none text-ink-900 dark:text-white">{v}</p>
                                        <div className="mt-2"><CalcToggle id={k} open={openCalc} onToggle={toggleCalc}><p>{sub}</p></CalcToggle></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <Card className="p-5">
                    <div className="mb-2 flex items-baseline gap-2"><h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">% of Target Achieved</h2><span className="text-xs text-ink-500">by {grain}</span></div>
                    <BarChart points={report?.charts.target ?? []} grain={grain} empty="No target data for this selection." />
                </Card>
                <Card className="p-5">
                    <div className="mb-2 flex items-baseline gap-2"><h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">% of Goal Achieved</h2><span className="text-xs text-ink-500">by {grain}</span></div>
                    <BarChart points={report?.charts.goal ?? []} grain={grain} empty="No goals for this selection." />
                </Card>
            </div>

            <DataTable title="Target performance" note={`${report?.targetTable.length ?? 0} rows · by ${grain}`} cols={tCols} rows={report?.targetTable ?? []} csvName={`target-performance-${from}-to-${to}.csv`} empty="No target entries match these filters." />
            <DataTable title="Goal performance" note={`${report?.goalTable.length ?? 0} rows · by ${grain}`} cols={gCols} rows={report?.goalTable ?? []} csvName={`goal-performance-${from}-to-${to}.csv`} empty="No goals match these filters." />
        </section>
    );
}
