import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Spinner } from "@heroui/react";
import { cn } from "@heroui/theme";
import { ArrowLeft, MessageSquareWarning, Search } from "lucide-react";

import { Panel, SummaryBar } from "@/components/page";
import { Button, Chip, Textarea, addToast } from "@/components/ui";
import { appraisalApi, errorText, type BoardRow, type Round, type RoundPerson } from "./api";
import { LEVEL_LABEL, SHARE_COLOR, SHARE_LABEL, day, inr, parseAmount, periodLabel, showAmount } from "./format";
import { Banner, BudgetLog, RoundChip, SplitTable } from "./parts";

const ORDER = { BUDGET_NEGOTIATION: 0, READY_FOR_FINANCE: 1, COLLECTING: 2, BUDGET_WITH_EL: 3, BUDGET_ACCEPTED: 4, SHARES_WITH_FLS: 5, FINALISED: 6 } as const;
/** Rows the Finance Head has to act on: a complete department, or an EL negotiating */
const forMe = (s: keyof typeof ORDER) => s === "READY_FOR_FINANCE" || s === "BUDGET_NEGOTIATION";
const Progress = ({ done, total }: { done: number; total: number }) => (
    <div className="flex items-center gap-2">
        <span className="h-1.5 w-12 overflow-hidden bg-ink-100 dark:bg-white/10"><span className={cn("block h-full", done === total && total > 0 ? "bg-emerald-500" : "bg-brand-500")} style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></span>
        <span className="text-xs tabular-nums text-ink-600 dark:text-ink-300">{done} / {total}</span>
    </div>
);

// ── Finance Head: every department of a period ────────────────────────────────────────────────────

export function DepartmentBoard() {
    const nav = useNavigate();
    const [periods, setPeriods] = useState<string[]>([]);
    const [period, setPeriod] = useState("");
    const [rows, setRows] = useState<BoardRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    useEffect(() => { appraisalApi.periods().then((p) => { setPeriods(p); setPeriod(p[0] ?? ""); }).catch((e) => addToast({ title: "Could not load the cycles", description: errorText(e), color: "danger" })); }, []);
    useEffect(() => {
        if (!period) return;
        setLoading(true);
        appraisalApi.board(period).then(setRows).catch((e) => addToast({ title: "Could not load the departments", description: errorText(e), color: "danger" })).finally(() => setLoading(false));
    }, [period]);

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return rows.filter((r) => !q || r.department.toLowerCase().includes(q) || (r.el?.name ?? "").toLowerCase().includes(q))
            .sort((a, b) => ORDER[a.status] - ORDER[b.status] || Number(b.people > 0) - Number(a.people > 0) || a.department.localeCompare(b.department));
    }, [rows, query]);
    const ready = rows.filter((r) => r.status === "READY_FOR_FINANCE").length;
    const negotiating = rows.filter((r) => r.status === "BUDGET_NEGOTIATION").length;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
                {periods.map((p) => <Button key={p} size="sm" variant={p === period ? "solid" : "bordered"} color={p === period ? "primary" : "default"} onPress={() => setPeriod(p)}>{periodLabel(p)}</Button>)}
            </div>
            <SummaryBar className="mb-0" items={[
                { label: "Waiting for you", value: ready + negotiating, hint: negotiating ? `${negotiating} EL${negotiating === 1 ? "" : "s"} negotiating, ${ready} ready for a budget` : ready ? "Every appeal is in: set their budget" : "Nothing waiting" },
                { label: "Budgets given", value: inr(rows.reduce((t, r) => t + (r.budget ?? 0), 0)), hint: `${rows.filter((r) => r.budget != null).length} departments` },
                { label: "Expected across the company", value: inr(rows.reduce((t, r) => t + r.expected, 0)), hint: `Targeted ${inr(rows.reduce((t, r) => t + r.target, 0))}` },
                { label: "Appeals in", value: `${rows.reduce((t, r) => t + r.submitted, 0)} / ${rows.reduce((t, r) => t + r.people, 0)}` },
            ]} />
            <Panel flush title="Departments" actions={
                <label className="relative block w-60">
                    <span className="sr-only">Find a department or an EL</span>
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a department or EL" className="h-8 w-full border border-ink-200 bg-transparent pl-9 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500 dark:border-white/10 dark:text-white" />
                </label>}>
                {loading ? <div className="flex justify-center py-16"><Spinner /></div> : (
                    <div className="max-h-[640px] overflow-auto">
                        <table className="w-full min-w-[960px] text-sm">
                            <thead className="sticky top-0 z-10"><tr className="border-b border-ink-200 bg-ink-50 text-left dark:border-white/10 dark:bg-ink-800">
                                {["Department", "Executive Leader", "Appeals in", "Department Total Expected", "Department Total Targeted", "Budget", "Status", ""].map((h, i) => <th key={h + i} className={cn("px-3 py-2.5", i >= 3 && i <= 5 && "text-right", (i === 3 || i === 4) && "w-[120px] whitespace-normal leading-tight")}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {shown.map((r) => (
                                    <tr key={r.departmentId} className={cn("border-b border-ink-100 last:border-0 dark:border-white/5", r.status === "READY_FOR_FINANCE" && "bg-amber-50/60 dark:bg-amber-500/5", r.status === "BUDGET_NEGOTIATION" && "bg-rose-50 shadow-[inset_4px_0_0_0] shadow-rose-500 dark:bg-rose-500/10")}>
                                        <td className="max-w-[220px] px-3 py-3">
                                            <p className="truncate font-semibold text-ink-900 dark:text-white" title={r.department}>{r.department}</p>
                                            {r.status === "BUDGET_NEGOTIATION" && <p className="mt-0.5 flex items-start gap-1 whitespace-normal text-xs font-semibold leading-snug text-rose-700 dark:text-rose-300"><MessageSquareWarning size={12} />{r.el?.name ?? "The EL"} resubmitted for negotiation{r.ask?.amount != null ? ` · asks ${inr(r.ask.amount)}` : ""}</p>}
                                        </td>
                                        <td className="max-w-[130px] truncate px-3 py-3 text-ink-600 dark:text-ink-300" title={r.el?.name}>{r.el?.name ?? "—"}</td>
                                        <td className="px-3 py-3">{r.people ? <Progress done={r.submitted} total={r.people} /> : <span className="text-xs text-ink-400">No appraisals</span>}</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{inr(r.expected)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{inr(r.target)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{r.budget == null ? <span className="text-xs text-ink-400">Not set</span> : inr(r.budget)}</td>
                                        <td className="px-3 py-3"><RoundChip status={r.status} /></td>
                                        <td className="px-3 py-3 text-right"><Button size="sm" color={r.status === "BUDGET_NEGOTIATION" ? "danger" : forMe(r.status) ? "primary" : "default"} variant={forMe(r.status) ? "solid" : "bordered"} isDisabled={!r.people} onPress={() => nav(`/appraisal/departments/${r.departmentId}/${period}${r.status === "FINALISED" ? "?view=split" : ""}`)}>{r.status === "BUDGET_NEGOTIATION" ? "Respond" : r.status === "READY_FOR_FINANCE" ? "Set budget" : r.status === "FINALISED" ? "View split" : "Open"}</Button></td>
                                    </tr>
                                ))}
                                {!shown.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-ink-500">No department matches.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </div>
    );
}

// ── Finance Head: one department, its appeals on a timeline, its budget ───────────────────────────

function AppealCard({ p }: { p: RoundPerson }) {
    return (
        <div className="relative flex flex-col gap-2 border-l border-ink-200 pb-5 pl-5 last:pb-0 dark:border-white/10">
            <span className={cn("absolute -left-[5px] top-1 h-2.5 w-2.5", p.submittedAt ? "bg-brand-600" : "bg-ink-300 dark:bg-white/20")} />
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm"><Link to={`/appraisal/person/${p.cycleId}`} className="font-bold text-ink-900 hover:text-brand-700 hover:underline dark:text-white">{p.name}</Link> <span className="text-ink-500">· {LEVEL_LABEL[p.level]}{p.a1 ? ` · reports to ${p.a1.name}` : ""}</span></p>
                <span className="text-xs text-ink-500">{p.submittedAt ? day(p.submittedAt) : "Not submitted"}</span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-600 dark:text-ink-300">
                <span>Expected <b className="tabular-nums text-ink-900 dark:text-white">{inr(p.expected)}</b></span>
                <span>Target <b className="tabular-nums text-ink-900 dark:text-white">{inr(p.target)}</b></span>
                <span>PMS {p.pmsAvg != null ? <b className="text-ink-900 dark:text-white">{p.pmsAvg}</b> : "—"}{p.pmsQuarters ? ` (${p.pmsQuarters} quarters)` : ""}</span>
                {p.currentAnnualCtc != null && <span>Current CTC <b className="tabular-nums text-ink-900 dark:text-white">{inr(p.currentAnnualCtc)}</b></span>}
            </div>
            {p.why && <p className="max-w-[70ch] whitespace-pre-wrap border-l-2 border-ink-200 pl-3 text-sm text-ink-700 dark:border-white/10 dark:text-ink-200">{p.why}</p>}
        </div>
    );
}

export function DepartmentDetail() {
    const { departmentId, period } = useParams();
    const nav = useNavigate();
    const [params] = useSearchParams();
    const [r, setR] = useState<Round | null>(null);
    const [amount, setAmount] = useState("");
    const [comment, setComment] = useState("");
    const [busy, setBusy] = useState(false);
    const load = useCallback(async () => {
        try { const x = await appraisalApi.round(Number(departmentId), String(period)); setR(x); setAmount(showAmount(x.budget)); setComment(x.financeComment); }
        catch (e) { addToast({ title: "Could not open the department", description: errorText(e), color: "danger" }); }
    }, [departmentId, period]);
    useEffect(() => { load(); }, [load]);
    // "View split" from the board opens straight on the split
    useEffect(() => { if (r && params.get("view") === "split") document.getElementById("split")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [r, params]);
    if (!r) return <div className="flex justify-center py-20"><Spinner /></div>;

    const timeline = [...r.people].sort((a, b) => (a.submittedAt ?? "9").localeCompare(b.submittedAt ?? "9"));
    const editable = r.status === "COLLECTING" || r.status === "READY_FOR_FINANCE" || r.status === "BUDGET_WITH_EL" || r.status === "BUDGET_NEGOTIATION";
    const lastAsk = r.status === "BUDGET_NEGOTIATION" ? [...r.budgetLog].reverse().find((l) => l.action === "NEGOTIATE") : undefined;
    const amt = parseAmount(amount);
    const pmsVals = r.people.filter((p) => p.pmsAvg != null).map((p) => p.pmsAvg!);
    const send = async () => {
        if (amt == null || !comment.trim()) { addToast({ title: "Enter the amount and why", color: "warning" }); return; }
        setBusy(true);
        try { await appraisalApi.setBudget(r.departmentId, r.period, amt, comment.trim()); addToast({ title: `Budget submitted to ${r.el?.name ?? "the EL"}`, description: "They accept it or negotiate it.", color: "success" }); await load(); }
        catch (e) { addToast({ title: "Could not send the budget", description: errorText(e), color: "danger" }); }
        finally { setBusy(false); }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Button size="sm" variant="light" startContent={<ArrowLeft size={14} />} onPress={() => nav("/appraisal/departments")}>All departments</Button>
                <RoundChip status={r.status} />
            </div>
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-ink-900 dark:text-white">{r.department}</h2>
                <p className="text-sm text-ink-500">{periodLabel(r.period)} · Executive Leader {r.el?.name ?? "not set"}</p>
            </div>
            <SummaryBar className="mb-0" items={[
                { label: "Department Total Expected", value: inr(r.totals.expected) },
                { label: "Department Total Targeted", value: inr(r.totals.target) },
                { label: "Appeals in", value: `${r.totals.submitted} / ${r.totals.people}`, hint: r.complete ? "Everyone has appealed" : "Some have not appealed yet" },
                { label: "Average PMS", value: pmsVals.length ? (pmsVals.reduce((t, v) => t + v, 0) / pmsVals.length).toFixed(2) : "—" },
            ]} />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
                <Panel title="Appeals as they came in">
                    <div className="flex flex-col">
                        {timeline.map((p) => <AppealCard key={p.cycleId} p={p} />)}
                        {r.notStarted.length > 0 && <p className="mt-4 text-xs text-ink-500">Not opened yet: {r.notStarted.map((n) => n.name).join(", ")}</p>}
                        {!timeline.length && <p className="py-8 text-center text-sm text-ink-500">Nobody in this department has an appraisal yet.</p>}
                    </div>
                </Panel>
                <div className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
                    {lastAsk && (
                        <div role="status" className="flex flex-col gap-2 border-2 border-rose-500 bg-rose-50 p-4 dark:bg-rose-500/10">
                            <p className="flex items-center gap-2 text-sm font-bold text-rose-800 dark:text-rose-200"><MessageSquareWarning size={16} />{lastAsk.by?.name ?? r.el?.name ?? "The EL"} resubmitted for negotiation</p>
                            {lastAsk.amount != null && <p className="text-sm text-ink-800 dark:text-ink-100">Asks for <b className="tabular-nums">{inr(lastAsk.amount)}</b> instead of <b className="tabular-nums">{inr(r.budget)}</b></p>}
                            {lastAsk.comment && <p className="whitespace-pre-wrap border-l-2 border-rose-400 pl-3 text-sm text-ink-800 dark:text-ink-100">{lastAsk.comment}</p>}
                            <p className="text-xs text-ink-600 dark:text-ink-300">Revise the budget below with your answer and submit it again.</p>
                        </div>
                    )}
                    <Panel title={`Budget for ${r.department}`}>
                        {editable ? (
                            <div className="flex flex-col gap-4">
                                {!r.complete && <Banner tone="warn">{r.totals.people - r.totals.submitted} {r.totals.people - r.totals.submitted === 1 ? "person has" : "people have"} not appealed yet. You can still set the budget now.</Banner>}
                                {r.status === "BUDGET_WITH_EL" && <Banner>Submitted to {r.el?.name} on {day(r.budgetSetAt)}. Waiting for them to accept or negotiate; you can still change it.</Banner>}
                                <label className="flex flex-col gap-1.5">
                                    <span className="eyebrow">Amount per year</span>
                                    <input inputMode="numeric" placeholder="₹" value={amount} onChange={(e) => setAmount(showAmount(parseAmount(e.target.value)))} className="h-11 border border-ink-200 bg-transparent px-3 text-lg font-bold tabular-nums text-ink-900 outline-none focus:border-brand-500 dark:border-white/10 dark:text-white" />
                                    {amt != null && r.totals.expected > 0 && <span className="text-xs text-ink-500">{Math.round((amt / r.totals.expected) * 100)}% of what was expected, {Math.round((amt / Math.max(1, r.totals.target)) * 100)}% of the target</span>}
                                </label>
                                <Textarea label={r.status === "BUDGET_NEGOTIATION" ? "Your answer to the EL (required)" : "Why this budget (required)"} minRows={4} value={comment} onValueChange={setComment} description={`Goes to ${r.el?.name ?? "the EL"} with the amount, and stays in the budget log.`} />
                                <Button color="primary" isLoading={busy} isDisabled={!r.el || amt == null || !comment.trim()} onPress={send}>{r.budgetLog.length ? "Submit revised budget" : "Submit budget"}</Button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <p className="text-3xl font-bold tabular-nums text-ink-900 dark:text-white">{inr(r.budget)}</p>
                                <p className="whitespace-pre-wrap border-l-2 border-brand-500 pl-3 text-sm text-ink-700 dark:text-ink-200">{r.financeComment}</p>
                                <p className="text-xs text-ink-500">Accepted by {r.el?.name} on {day(r.elAcceptedAt)}{r.elSentAt ? ` · split on ${day(r.elSentAt)} · ${inr(r.totals.allocated)} decided so far` : " · being split"}</p>
                            </div>
                        )}
                    </Panel>
                    {r.budgetLog.length > 0 && <Panel title="Budget discussion"><BudgetLog log={r.budgetLog} budget={r.budget} /></Panel>}
                    {r.shares.length > 0 && r.elSentAt && (
                        <Panel flush title="FL shares">
                            {r.shares.map((s) => (
                                <div key={s.flUserId} className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-3 last:border-0 dark:border-white/5">
                                    <div><p className="text-sm font-semibold text-ink-900 dark:text-white">{s.name}</p><p className="text-xs text-ink-500">{inr(s.allocated)} of {inr(s.amount)} · {s.people} {s.people === 1 ? "person" : "people"}</p></div>
                                    <Chip size="sm" variant="flat" color={SHARE_COLOR[s.status]}>{SHARE_LABEL[s.status]}</Chip>
                                </div>
                            ))}
                        </Panel>
                    )}
                </div>
            </div>
            {r.elSentAt && <div id="split" className="scroll-mt-4"><Panel flush title={r.status === "FINALISED" ? `Final split · ${r.department}` : `Split so far · ${r.department}`}><SplitTable r={r} /></Panel></div>}
        </div>
    );
}
