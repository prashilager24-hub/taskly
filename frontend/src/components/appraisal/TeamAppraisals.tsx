import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spinner } from "@heroui/react";
import { Check, Minus } from "lucide-react";
import { cn } from "@heroui/theme";

import { Panel, Segmented, SummaryBar } from "@/components/page";
import { Button, addToast } from "@/components/ui";
import { appraisalApi, errorText, type TeamItem } from "./api";
import { LEVEL_LABEL, day, inr } from "./format";
import { StatusChip } from "./parts";

type Filter = "todo" | "all";

const Tick = ({ on, label }: { on: boolean; label: string }) => (
    <span className={cn("inline-flex items-center gap-1 text-xs", on ? "text-emerald-600 dark:text-emerald-400" : "text-ink-400")} title={`${label}: ${on ? "submitted" : "not yet"}`}>
        {on ? <Check size={13} /> : <Minus size={13} />}{label}
    </span>
);

const needsMe = (r: TeamItem) => r.status === "ASSESSOR_OPEN" && ((r.myRole === "A1" && !r.a1Submitted) || (r.myRole === "A2" && !r.a2Submitted));

// Team Appraisals: the people whose appraisal I review (as first or second assessor).
export default function TeamAppraisals() {
    const nav = useNavigate();
    const [rows, setRows] = useState<TeamItem[]>([]);
    const [sum, setSum] = useState<{ annual: number; count: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Filter>("todo");

    const load = useCallback(async () => {
        try { const r = await appraisalApi.team(); setRows(r.items); setSum(r.sumTotal); }
        catch (e) { addToast({ title: "Could not load the team", description: errorText(e), color: "danger" }); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const todo = useMemo(() => rows.filter(needsMe), [rows]);
    const shown = filter === "todo" ? todo : rows;

    if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
    return (
        <div className="flex flex-col gap-6">
            <SummaryBar className="mb-0" items={[
                { label: "Waiting for my review", value: todo.length, hint: "Open in the assessor window" },
                { label: "In my team", value: rows.length },
                ...(sum ? [{ label: "Approved so far", value: inr(sum.annual), hint: `${sum.count} approved hike${sum.count === 1 ? "" : "s"}, per year` }] : []),
            ]} />
            <Panel flush title="Appraisals" actions={<Segmented size="sm" label="Show" value={filter} onChange={setFilter} options={[{ key: "todo", label: `Needs my review (${todo.length})` }, { key: "all", label: "Everyone" }]} />}>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                        <thead>
                            <tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">
                                {["Person", "Status", "Assessor window", "Progress", ""].map((h) => <th key={h} className="px-4 py-2.5 text-left">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {shown.map((r) => (
                                <tr key={r.cycleId} className="border-b border-ink-100 last:border-0 dark:border-white/5">
                                    <td className="px-4 py-3"><p className="font-semibold text-ink-900 dark:text-white">{r.employeeName}</p><p className="text-xs text-ink-500">{LEVEL_LABEL[r.level]} · you are {r.myRole === "A1" ? "assessor 1" : r.myRole === "A2" ? "assessor 2" : "Finance"}</p></td>
                                    <td className="px-4 py-3"><StatusChip status={r.status} /></td>
                                    <td className="px-4 py-3 text-xs text-ink-600 dark:text-ink-300">{day(r.employeeWindowEnd)} → {day(r.assessorWindowEnd)}</td>
                                    <td className="px-4 py-3"><div className="flex items-center gap-3"><Tick on={r.selfSubmitted} label="Self" /><Tick on={r.a1Submitted} label="A1" /><Tick on={r.a2Submitted} label="A2" /></div></td>
                                    <td className="px-4 py-3 text-right"><Button size="sm" color={needsMe(r) ? "primary" : "default"} variant={needsMe(r) ? "solid" : "bordered"} onPress={() => nav(`/appraisal/team/${r.cycleId}`)}>{needsMe(r) ? "Review" : "Open"}</Button></td>
                                </tr>
                            ))}
                            {!shown.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-ink-500">{filter === "todo" ? "Nothing is waiting for your review." : "Nobody in your team has an appraisal yet."}</td></tr>}
                        </tbody>
                    </table>
                </div>
            </Panel>
        </div>
    );
}
