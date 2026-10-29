import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spinner } from "@heroui/react";
import { cn } from "@heroui/theme";

import { Panel, SummaryBar } from "@/components/page";
import { Button, addToast } from "@/components/ui";
import { appraisalApi, errorText, type BudgetOverview, type DeptBudget, type TeamItem } from "./api";
import { day, inr, parseAmount, showAmount } from "./format";
import { Banner, StatusChip } from "./parts";

const inputCls = "h-9 w-36 border border-ink-200 bg-transparent px-2.5 text-right text-[13px] text-ink-900 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-ink-900 dark:text-white";
const left = (n: number) => <span className={cn("font-semibold tabular-nums", n < 0 ? "text-rose-600" : "text-emerald-600")}>{inr(n)}</span>;

/** A rupee box that saves on its own button, so a half-typed number is never sent */
function AmountSave({ initial, label, onSave }: { initial: number | null; label: string; onSave: (amount: number) => Promise<void> }) {
    const [v, setV] = useState(showAmount(initial));
    const [busy, setBusy] = useState(false);
    useEffect(() => setV(showAmount(initial)), [initial]);
    const dirty = parseAmount(v) !== initial && v !== "";
    return (
        <div className="flex items-center justify-end gap-2">
            <input aria-label={label} inputMode="numeric" placeholder="₹ per year" className={inputCls} value={v} onChange={(e) => setV(showAmount(parseAmount(e.target.value)))} />
            <Button size="sm" color="primary" isLoading={busy} isDisabled={!dirty} onPress={async () => { setBusy(true); try { await onSave(parseAmount(v) ?? 0); } finally { setBusy(false); } }}>Save</Button>
        </div>
    );
}

const th = (h: string, right = false) => <th key={h} className={cn("px-4 py-2.5", right ? "text-right" : "text-left")}>{h}</th>;

// ── Finance: gives each EL a budget for the department, and approves the EL's own hike ─────────────

function FinanceView({ year, departments, onChanged }: { year: number; departments: DeptBudget[]; onChanged: () => void }) {
    const nav = useNavigate();
    const [waiting, setWaiting] = useState<TeamItem[]>([]);
    useEffect(() => { appraisalApi.team("FINANCE_REVIEW").then((t) => setWaiting(t.items.filter((i) => i.level === "HEAD_EL"))).catch(() => setWaiting([])); }, [departments]);
    const total = departments.reduce((t, d) => t + (d.budget ?? 0), 0);
    const [query, setQuery] = useState("");
    // departments that already have a budget come first, so work in progress is not buried among 48 rows
    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return departments.filter((d) => !q || d.name.toLowerCase().includes(q) || (d.el?.name ?? "").toLowerCase().includes(q))
            .sort((a, b) => Number(b.budget != null) - Number(a.budget != null) || a.name.localeCompare(b.name));
    }, [departments, query]);
    return (
        <div className="flex flex-col gap-6">
            <SummaryBar className="mb-0" items={[
                { label: `Budget given for ${year}`, value: inr(total), hint: `${departments.filter((d) => d.budget != null).length} of ${departments.length} departments` },
                { label: "Given out by the ELs", value: inr(departments.reduce((t, d) => t + d.allocated, 0)) },
                { label: "Proposed or approved", value: inr(departments.reduce((t, d) => t + d.used, 0)) },
                { label: "EL hikes waiting for you", value: waiting.length },
            ]} />
            <Panel flush title="Department budgets" actions={
                <label className="relative block w-60">
                    <span className="sr-only">Find a department or an EL</span>
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a department or EL" className="h-8 w-full border border-ink-200 bg-transparent px-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500 dark:border-white/10 dark:text-white" />
                </label>}>
                <div className="max-h-[620px] overflow-auto">
                    <table className="w-full min-w-[820px] text-sm">
                        <thead className="sticky top-0 z-10"><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">{[th("Department"), th("Executive Leader"), th("Budget for the EL", true), th("Given to FLs", true), th("Used", true), th("Left", true)]}</tr></thead>
                        <tbody>
                            {shown.map((d) => (
                                <tr key={d.departmentId} className="border-b border-ink-100 last:border-0 dark:border-white/5">
                                    <td className="max-w-[260px] truncate px-4 py-3 font-semibold text-ink-900 dark:text-white" title={d.name}>{d.name}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-ink-600 dark:text-ink-300">{d.el?.name ?? "—"}</td>
                                    <td className="px-4 py-3">
                                        <AmountSave initial={d.budget} label={`Budget for ${d.name}`} onSave={async (amount) => {
                                            try { await appraisalApi.setDepartmentBudget({ year, departmentId: d.departmentId, amount }); addToast({ title: `Budget saved for ${d.name}`, color: "success" }); onChanged(); }
                                            catch (e) { addToast({ title: "Could not save", description: errorText(e), color: "danger" }); }
                                        }} />
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">{inr(d.allocated)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{inr(d.used)}</td>
                                    <td className="px-4 py-3 text-right">{d.budget == null ? <span className="text-xs text-ink-400">Not set</span> : left(d.budget - d.used)}</td>
                                </tr>
                            ))}
                            {!shown.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-ink-500">{departments.length ? "No department matches." : "No department has an Executive Leader yet."}</td></tr>}
                        </tbody>
                    </table>
                </div>
            </Panel>
            <Panel flush title="EL hikes waiting for your approval">
                {waiting.length ? waiting.map((w) => (
                    <div key={w.cycleId} className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-5 py-4 last:border-0 dark:border-white/10">
                        <div><p className="font-semibold text-ink-900 dark:text-white">{w.employeeName}</p><p className="text-xs text-ink-500">Executive Leader · assessor window ended {day(w.assessorWindowEnd)}</p></div>
                        <div className="flex items-center gap-4"><StatusChip status={w.status} /><Button size="sm" color="primary" onPress={() => nav(`/appraisal/team/${w.cycleId}`)}>Review and approve</Button></div>
                    </div>
                )) : <p className="px-5 py-10 text-center text-sm text-ink-500">No EL hike is waiting.</p>}
            </Panel>
        </div>
    );
}

// ── EL: splits the department budget between the FLs / Managers ───────────────────────────────────

function ElView({ year, departments, onChanged }: { year: number; departments: DeptBudget[]; onChanged: () => void }) {
    return (
        <div className="flex flex-col gap-6">
            {departments.map((d) => (
                <Panel key={d.departmentId} flush title={d.name}>
                    <div className="grid grid-cols-1 border-b border-ink-200 dark:border-white/10 sm:grid-cols-4">
                        {[["Budget from Finance", d.budget == null ? "Not set" : inr(d.budget)], ["Given to FLs", inr(d.allocated)], ["Still to give", d.budget == null ? "—" : inr(d.budget - d.allocated)], ["Proposed or approved", inr(d.used)]].map(([k, v], i) => (
                            <div key={k} className={cn("px-5 py-4", i > 0 && "border-t border-ink-200 dark:border-white/10 sm:border-l sm:border-t-0")}><p className="eyebrow">{k}</p><p className="mt-1.5 text-xl font-bold text-ink-900 dark:text-white">{v}</p></div>
                        ))}
                    </div>
                    {d.budget == null ? <div className="p-5"><Banner tone="warn">Finance has not given {d.name} a budget for {year} yet. You can split it as soon as they do.</Banner></div> : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-sm">
                                <thead><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">{[th("FL / Manager"), th("People", true), th("Budget given", true), th("Proposed or approved", true), th("Left", true)]}</tr></thead>
                                <tbody>
                                    {d.fls.map((f) => (
                                        <tr key={f.userId} className="border-b border-ink-100 last:border-0 dark:border-white/5">
                                            <td className="px-4 py-3 font-semibold text-ink-900 dark:text-white">{f.name}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{f.associates}</td>
                                            <td className="px-4 py-3"><AmountSave initial={f.allocation || null} label={`Budget for ${f.name}`} onSave={async (amount) => {
                                                try { await appraisalApi.setAllocation({ year, departmentId: d.departmentId, flUserId: f.userId, amount }); addToast({ title: `Budget given to ${f.name}`, color: "success" }); onChanged(); }
                                                catch (e) { addToast({ title: "Could not save", description: errorText(e), color: "danger" }); }
                                            }} /></td>
                                            <td className="px-4 py-3 text-right tabular-nums">{inr(f.used)}</td>
                                            <td className="px-4 py-3 text-right">{left(f.remaining)}</td>
                                        </tr>
                                    ))}
                                    {!d.fls.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-500">No FL or Manager works in this department yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>
            ))}
        </div>
    );
}

// ── FL: the share the EL gave, nothing else ───────────────────────────────────────────────────────

function FlView({ shares }: { shares: { departmentId: number; name: string; allocation: number; used: number; remaining: number; associates: number }[] }) {
    return (
        <div className="flex flex-col gap-6">
            {shares.map((s) => (
                <SummaryBar key={s.departmentId} className="mb-0" items={[
                    { label: "Team budget", value: inr(s.allocation), hint: `${s.name} · given to you by your EL` },
                    { label: "Proposed or approved", value: inr(s.used), hint: `${s.associates} ${s.associates === 1 ? "person" : "people"} in your team` },
                    { label: "Left to give", value: <span className={s.remaining < 0 ? "text-rose-600" : "text-emerald-600"}>{inr(s.remaining)}</span> },
                ]} />
            ))}
        </div>
    );
}

// Budget: Finance gives each EL a budget, the EL splits it between FLs, each FL proposes hikes inside their share.
export default function Budget() {
    const [data, setData] = useState<BudgetOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const year = useMemo(() => new Date().getFullYear(), []);
    const load = useCallback(async () => {
        try { setData(await appraisalApi.budget(year)); }
        catch (e) { addToast({ title: "Could not load the budget", description: errorText(e), color: "danger" }); }
        finally { setLoading(false); }
    }, [year]);
    useEffect(() => { load(); }, [load]);

    if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
    if (!data || data.role === "NONE") return <Panel><p className="py-10 text-center text-sm text-ink-500">There is no budget for you to see.</p></Panel>;
    if (data.role === "FINANCE") return <FinanceView year={year} departments={data.departments} onChanged={load} />;
    if (data.role === "EL") return <ElView year={year} departments={data.departments} onChanged={load} />;
    return <FlView shares={data.shares} />;
}
