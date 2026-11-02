import { Fragment, useEffect, useMemo, useState } from "react";
import { Spinner } from "@heroui/react";
import { cn } from "@heroui/theme";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

import { Panel, SummaryBar } from "@/components/page";
import { Button, Chip, addToast } from "@/components/ui";
import { appraisalApi, errorText, type Overview as Data, type RoundStatus } from "./api";
import { ROUND_LABEL, SHARE_COLOR, SHARE_LABEL, inr, pctOf, periodLabel } from "./format";
import { BudgetLog, RoundChip, SplitTable } from "./parts";

const STATUSES = Object.keys(ROUND_LABEL) as RoundStatus[];
const box = "h-8 border border-ink-200 bg-transparent text-[13px] text-ink-900 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-ink-900 dark:text-white";

// Overview (Admin, Super Administrator, Finance Head): how the appraisal is going in every department of a cycle, with
// each department's split one click away. Read only.
export default function Overview() {
    const [periods, setPeriods] = useState<string[]>([]);
    const [period, setPeriod] = useState("");
    const [data, setData] = useState<Data | null>(null);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<RoundStatus | "">("");
    const [all, setAll] = useState(false);
    const [open, setOpen] = useState<number | null>(null);
    useEffect(() => { appraisalApi.periods().then((p) => { setPeriods(p); setPeriod(p[0] ?? ""); }).catch((e) => addToast({ title: "Could not load the cycles", description: errorText(e), color: "danger" })); }, []);
    useEffect(() => {
        if (!period) return;
        setLoading(true); setOpen(null);
        appraisalApi.overview(period).then(setData).catch((e) => addToast({ title: "Could not load the overview", description: errorText(e), color: "danger" })).finally(() => setLoading(false));
    }, [period]);

    const rows = data?.rows ?? [];
    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return rows.filter((r) => (all || r.people > 0) && (!status || r.status === status) && (!q || r.department.toLowerCase().includes(q) || (r.el?.name ?? "").toLowerCase().includes(q)))
            .sort((a, b) => Number(b.people > 0) - Number(a.people > 0) || a.department.localeCompare(b.department));
    }, [rows, query, status, all]);
    const sum = (f: (r: (typeof rows)[number]) => number) => shown.reduce((t, r) => t + f(r), 0);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
                {periods.map((p) => <Button key={p} size="sm" variant={p === period ? "solid" : "bordered"} color={p === period ? "primary" : "default"} onPress={() => setPeriod(p)}>{periodLabel(p)}</Button>)}
            </div>
            <SummaryBar className="mb-0" items={[
                { label: "Departments", value: shown.length, hint: `${shown.filter((r) => r.status === "FINALISED").length} finalised` },
                { label: "Appeals in", value: `${sum((r) => r.submitted)} / ${sum((r) => r.people)}` },
                { label: "Department total expected", value: inr(sum((r) => r.expected)), hint: `Targeted ${inr(sum((r) => r.target))}` },
                { label: "Department budgets", value: inr(sum((r) => r.budget ?? 0)), hint: `${inr(sum((r) => r.allocated))} decided so far` },
            ]} />
            <Panel flush title="Every department" actions={
                <div className="flex flex-wrap items-center gap-2">
                    <label className="relative block w-56">
                        <span className="sr-only">Find a department or an EL</span>
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a department or EL" className={cn(box, "w-full pl-9 pr-3 placeholder:text-ink-400")} />
                    </label>
                    <label className="sr-only" htmlFor="ov-status">Status</label>
                    <select id="ov-status" value={status} onChange={(e) => setStatus(e.target.value as RoundStatus | "")} className={cn(box, "px-2")}>
                        <option value="">Every status</option>
                        {STATUSES.map((s) => <option key={s} value={s}>{ROUND_LABEL[s]}</option>)}
                    </select>
                    <label className="flex items-center gap-1.5 text-xs text-ink-600 dark:text-ink-300"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="accent-brand-600" />Show departments without appraisals</label>
                </div>}>
                {loading ? <div className="flex justify-center py-16"><Spinner /></div> : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1080px] text-sm">
                            <thead><tr className="border-b border-ink-200 bg-ink-50 text-left dark:border-white/10 dark:bg-ink-800">
                                {["", "Department", "Executive Leader", "Appeals in", "Department Total Expected", "Department Total Targeted", "Budget", "Decided", "Status"].map((h, i) => <th key={h + i} className={cn("px-3 py-2.5", i >= 4 && i <= 7 && "text-right", (i === 4 || i === 5) && "w-[120px] whitespace-normal leading-tight")}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {shown.map((r) => {
                                    const round = data?.rounds.find((x) => x.departmentId === r.departmentId);
                                    const isOpen = open === r.departmentId;
                                    return (
                                        <Fragment key={r.departmentId}>
                                            <tr className={cn("border-b border-ink-100 dark:border-white/5", round && "cursor-pointer hover:bg-ink-50 dark:hover:bg-white/5", isOpen && "bg-brand-50/60 dark:bg-brand-600/10")} onClick={() => round && setOpen(isOpen ? null : r.departmentId)}>
                                                <td className="w-10 px-3 py-3 text-ink-500">{round ? (isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : null}</td>
                                                <td className="max-w-[220px] px-3 py-3"><p className="truncate font-semibold text-ink-900 dark:text-white" title={r.department}>{r.department}</p></td>
                                                <td className="max-w-[140px] truncate px-3 py-3 text-ink-600 dark:text-ink-300" title={r.el?.name}>{r.el?.name ?? "—"}</td>
                                                <td className="px-3 py-3 tabular-nums">{r.people ? `${r.submitted} / ${r.people}` : <span className="text-xs text-ink-400">No appraisals</span>}</td>
                                                <td className="px-3 py-3 text-right tabular-nums">{inr(r.expected)}</td>
                                                <td className="px-3 py-3 text-right tabular-nums">{inr(r.target)}</td>
                                                <td className="px-3 py-3 text-right tabular-nums">{r.budget == null ? <span className="text-xs text-ink-400">Not set</span> : <>{inr(r.budget)}<p className="text-xs text-ink-500">{pctOf(r.budget, r.expected)} of expected</p></>}</td>
                                                <td className="px-3 py-3 text-right tabular-nums">{r.allocated ? inr(r.allocated) : "—"}</td>
                                                <td className="px-3 py-3"><RoundChip status={r.status} /></td>
                                            </tr>
                                            {isOpen && round && (
                                                <tr className="border-b border-ink-200 dark:border-white/10"><td colSpan={9} className="bg-ink-50/50 p-4 dark:bg-white/[0.02]">
                                                    <div className="flex flex-col gap-4">
                                                        <p className="eyebrow">{round.status === "FINALISED" ? "Final split" : "Split so far"} · {round.department}</p>
                                                        <div className="border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900"><SplitTable people={round.people} budget={round.budget} ctc /></div>
                                                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                                            <div className="border border-ink-200 bg-white p-4 dark:border-white/10 dark:bg-ink-900"><p className="eyebrow mb-3">Budget discussion</p><BudgetLog log={round.budgetLog} budget={round.budget} /></div>
                                                            <div className="border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
                                                                <p className="eyebrow px-4 pt-4">FL shares</p>
                                                                {round.elSentAt && round.shares.length ? round.shares.map((s) => (
                                                                    <div key={s.flUserId} className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-2.5 last:border-0 dark:border-white/5">
                                                                        <div><p className="text-sm font-semibold text-ink-900 dark:text-white">{s.name}</p><p className="text-xs text-ink-500">{inr(s.allocated)} of {inr(s.amount)} · {s.people} {s.people === 1 ? "person" : "people"}</p></div>
                                                                        <Chip size="sm" variant="flat" color={SHARE_COLOR[s.status]}>{SHARE_LABEL[s.status]}</Chip>
                                                                    </div>
                                                                )) : <p className="px-4 py-3 text-sm text-ink-500">Not split yet.</p>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td></tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                                {!shown.length && <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-ink-500">No department matches.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </div>
    );
}
