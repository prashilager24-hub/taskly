import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Spinner } from "@heroui/react";

import { Panel, SummaryBar } from "@/components/page";
import { Button, Textarea, addToast } from "@/components/ui";
import { appraisalApi, errorText, type SumTotal, type TeamItem } from "./api";
import { LEVEL_LABEL, day, inr } from "./format";
import { HikeField, StatusChip } from "./parts";

function Figure({ label, value }: { label: string; value: string }) {
    return <div><p className="eyebrow">{label}</p><p className="mt-1 text-sm font-semibold text-ink-900 dark:text-white">{value}</p></div>;
}

/** One appraisal waiting for Finance: what was asked, what the assessors accept, and the approved hike */
function ApproveRow({ row, value, onChange, onApproved }: { row: TeamItem; value: number | null; onChange: (v: number | null) => void; onApproved: () => void }) {
    const [comment, setComment] = useState("");
    const [busy, setBusy] = useState(false);
    const approve = async () => {
        if (value == null) return;
        setBusy(true);
        try { await appraisalApi.approve(row.cycleId, { approvedHike: value, comment: comment.trim() || undefined }); addToast({ title: `Approved for ${row.employeeName}`, description: "The offer is now with the employee.", color: "success" }); onApproved(); }
        catch (e) { addToast({ title: "Could not approve", description: errorText(e), color: "danger" }); }
        finally { setBusy(false); }
    };
    const min = [row.minimal?.A1, row.minimal?.A2].filter(Boolean).map((m) => inr(m!.annual)).join(" / ");
    return (
        <div className="grid grid-cols-1 gap-4 border-b border-ink-200 p-5 last:border-0 dark:border-white/10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,1.4fr)_auto] lg:items-start">
            <div>
                <p className="font-semibold text-ink-900 dark:text-white">{row.employeeName}</p>
                <p className="text-xs text-ink-500">{LEVEL_LABEL[row.level]}</p>
                <Link to={`/appraisal/team/${row.cycleId}`} className="mt-1 inline-block text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400">See the reviews</Link>
            </div>
            <div className="grid grid-cols-2 gap-4"><Figure label="Expected" value={inr(row.expected?.annual)} /><Figure label="Minimal (A1 / A2)" value={min || "—"} /></div>
            <div className="flex flex-col gap-3">
                <HikeField label="Approved hike (per year)" value={value} onChange={onChange} level={row.level} />
                <Textarea label="Comment (optional)" minRows={1} value={comment} onValueChange={setComment} />
            </div>
            <Button color="primary" isLoading={busy} isDisabled={value == null} onPress={approve} className="lg:mt-0">Approve</Button>
        </div>
    );
}

// Budget Approval (Finance): approve each hike; the split is worked out for the person's level. Sum Total is the budget so far.
export default function BudgetApproval() {
    const [rows, setRows] = useState<TeamItem[]>([]);
    const [sum, setSum] = useState<SumTotal | null>(null);
    const [loading, setLoading] = useState(true);
    const [typed, setTyped] = useState<Record<number, number | null>>({});

    const load = useCallback(async () => {
        try { const r = await appraisalApi.team(); setRows(r.items); setSum(r.sumTotal); }
        catch (e) { addToast({ title: "Could not load the appraisals", description: errorText(e), color: "danger" }); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const pending = useMemo(() => rows.filter((r) => r.status === "FINANCE_REVIEW"), [rows]);
    const decided = useMemo(() => rows.filter((r) => r.approved), [rows]);
    const proposed = useMemo(() => pending.reduce((s, r) => s + (typed[r.cycleId] ?? 0), 0), [pending, typed]);

    if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
    return (
        <div className="flex flex-col gap-6">
            <SummaryBar className="mb-0" items={[
                { label: "Waiting for approval", value: pending.length },
                { label: "Sum Total approved", value: inr(sum?.annual ?? 0), hint: sum ? `${inr(sum.fixed)} fixed + ${inr(sum.variable)} variable, ${sum.count} hike${sum.count === 1 ? "" : "s"}` : undefined },
                { label: "Typed, not yet approved", value: inr(proposed), hint: "Adds up what you have entered below" },
            ]} />
            <Panel flush title="Waiting for approval">
                {pending.length ? pending.map((r) => (
                    <ApproveRow key={r.cycleId} row={r} value={typed[r.cycleId] ?? null} onChange={(v) => setTyped((t) => ({ ...t, [r.cycleId]: v }))} onApproved={load} />
                )) : <p className="px-5 py-12 text-center text-sm text-ink-500">Nothing is waiting for budget approval.</p>}
            </Panel>
            <Panel flush title="Approved">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">{["Person", "Status", "Approved per year", "Fixed", "Variable", "Window ended"].map((h) => <th key={h} className="px-4 py-2.5 text-left">{h}</th>)}</tr></thead>
                        <tbody>
                            {decided.map((r) => (
                                <tr key={r.cycleId} className="border-b border-ink-100 dark:border-white/5">
                                    <td className="px-4 py-3"><p className="font-semibold text-ink-900 dark:text-white">{r.employeeName}</p><p className="text-xs text-ink-500">{LEVEL_LABEL[r.level]}</p></td>
                                    <td className="px-4 py-3"><StatusChip status={r.status} /></td>
                                    <td className="px-4 py-3 font-semibold">{inr(r.approved!.annual)}</td>
                                    <td className="px-4 py-3">{inr(r.approved!.fixed)}</td>
                                    <td className="px-4 py-3">{inr(r.approved!.variable)}</td>
                                    <td className="px-4 py-3 text-xs text-ink-500">{day(r.assessorWindowEnd)}</td>
                                </tr>
                            ))}
                            {decided.length > 0 && (
                                <tr className="bg-ink-50 font-bold dark:bg-ink-800">
                                    <td className="px-4 py-3" colSpan={2}>Sum Total</td>
                                    <td className="px-4 py-3">{inr(sum?.annual ?? 0)}</td><td className="px-4 py-3">{inr(sum?.fixed ?? 0)}</td><td className="px-4 py-3">{inr(sum?.variable ?? 0)}</td><td />
                                </tr>
                            )}
                            {!decided.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-ink-500">No hike has been approved yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </Panel>
        </div>
    );
}

