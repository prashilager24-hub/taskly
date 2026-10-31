import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Spinner } from "@heroui/react";
import { Check, Minus } from "lucide-react";
import { cn } from "@heroui/theme";

import { Panel, Segmented, SummaryBar } from "@/components/page";
import { Button, Chip, addToast } from "@/components/ui";
import { appraisalApi, errorText, type BudgetOverview, type FlLine, type TeamItem } from "./api";
import { LEVEL_LABEL, day, inr } from "./format";
import { StatusChip } from "./parts";

type Filter = "todo" | "all";

const Tick = ({ on, label, who, final }: { on: boolean; label: string; who?: string | null; final?: boolean }) => (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-xs", on ? "text-emerald-600 dark:text-emerald-400" : "text-ink-400")} title={`${who ? `${label} · ${who}` : label}${final ? " · final say" : ""}: ${on ? "submitted" : "not yet"}`}>
        {on ? <Check size={13} /> : <Minus size={13} />}{label}{final && <span className="bg-brand-600 px-1 text-[9px] font-semibold uppercase tracking-wide text-white">Final</span>}
    </span>
);

/** Self, then each assessor actually set on this appraisal; the last one has the final say */
const Progress = ({ r }: { r: TeamItem }) => (
    <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
            <Tick on={r.selfSubmitted} label="Self" />
            {r.assessor1Name && <Tick on={r.a1Submitted} label="A1" who={r.assessor1Name} final={!r.assessor2Name} />}
            {r.assessor2Name && <Tick on={r.a2Submitted} label="A2" who={r.assessor2Name} final />}
            {!r.assessor1Name && !r.assessor2Name && <Tick on={r.status !== "EMPLOYEE_OPEN" && r.status !== "ASSESSOR_OPEN" && r.status !== "FINANCE_REVIEW"} label="Finance" final />}
        </div>
        <p className="max-w-[260px] truncate text-[11px] text-ink-500" title={[r.assessor1Name, r.assessor2Name].filter(Boolean).join(" → ")}>{[r.assessor1Name, r.assessor2Name].filter(Boolean).join(" → ") || "No assessor set"}</p>
    </div>
);

const needsMe = (r: TeamItem) => (r.status === "ASSESSOR_OPEN" && ((r.myRole === "A1" && !r.a1Submitted) || (r.myRole === "A2" && !r.a2Submitted))) || r.canApprove || r.canDecideRequests;
const proposedBy = (r: TeamItem) => (r.myRole === "A2" ? r.minimal?.A2 ?? r.minimal?.A1 : r.minimal?.A1) ?? null;

function Row({ r }: { r: TeamItem }) {
    const nav = useNavigate();
    const p = proposedBy(r);
    return (
        <tr className="border-b border-ink-100 last:border-0 dark:border-white/5">
            <td className="px-4 py-3"><p className="font-semibold text-ink-900 dark:text-white">{r.employeeName}</p><p className="text-xs text-ink-500">{LEVEL_LABEL[r.level]}</p></td>
            <td className="px-4 py-3 text-right tabular-nums">{r.pmsFinalAvg != null ? <><span className="font-semibold">{r.pmsFinalAvg}</span><span className="block text-xs text-ink-500">{r.pmsQuarters} quarter{r.pmsQuarters === 1 ? "" : "s"}</span></> : <span className="text-xs text-ink-400">No PMS</span>}</td>
            <td className="px-4 py-3 text-right tabular-nums">{r.expected ? <span className="font-semibold">{inr(r.expected.annual)}</span> : <span className="text-xs text-ink-400">Not entered</span>}</td>
            <td className="px-4 py-3 text-right tabular-nums">{p ? <span className="font-semibold">{inr(p.annual)}</span> : <span className="text-xs text-ink-400">Not proposed</span>}</td>
            <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">{r.asksDesignation && <Chip size="sm" variant="flat">Designation</Chip>}{r.asksTeam && <Chip size="sm" variant="flat">Team</Chip>}{!r.asksDesignation && !r.asksTeam && <span className="text-xs text-ink-400">None</span>}</div></td>
            <td className="px-4 py-3"><StatusChip status={r.status} /></td>
            <td className="px-4 py-3"><Progress r={r} /></td>
            <td className="px-4 py-3 text-right"><Button size="sm" color={needsMe(r) ? "primary" : "default"} variant={needsMe(r) ? "solid" : "bordered"} onPress={() => nav(`/appraisal/team/${r.cycleId}`)}>{r.canApprove ? "Approve" : r.canDecideRequests ? "Decide changes" : needsMe(r) ? "Review" : "Open"}</Button></td>
        </tr>
    );
}

const HEAD = ["Person", "PMS final (avg)", "Expected hike", "Proposed hike", "Asks for", "Status", "Progress", ""];

// Team Appraisals: everyone I assess, together. An FL sees the team and its budget; an EL sees every FL's team, one group per FL.
export default function TeamAppraisals() {
    const [rows, setRows] = useState<TeamItem[]>([]);
    const [budget, setBudget] = useState<BudgetOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Filter>("todo");

    const load = useCallback(async () => {
        try {
            const [t, b] = await Promise.all([appraisalApi.team(), appraisalApi.budget().catch(() => null)]);
            setRows(t.items); setBudget(b);
        } catch (e) { addToast({ title: "Could not load the team", description: errorText(e), color: "danger" }); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const todo = useMemo(() => rows.filter(needsMe), [rows]);
    const shown = filter === "todo" ? todo : rows;
    const groups = useMemo(() => {
        const g = new Map<string, TeamItem[]>();
        for (const r of shown) { const k = r.myRole === "A1" ? "Reporting to me" : r.assessor1Name ?? "No first assessor"; g.set(k, [...(g.get(k) ?? []), r]); }
        return [...g.entries()];
    }, [shown]);
    const isFin = budget?.role === "FINANCE";
    const isEl = isFin || budget?.role === "EL" || rows.some((r) => r.myRole === "A2");
    const flLine = (name: string): FlLine | undefined => (budget && "departments" in budget ? budget.departments.flatMap((d) => d.fls).find((f) => f.name === name) : undefined);
    const share = budget && "shares" in budget ? budget.shares[0] : null;

    if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
    return (
        <div className="flex flex-col gap-6">
            <SummaryBar className="mb-0" items={[
                { label: "Waiting for me", value: todo.length, hint: "Reviews to write, or hikes to approve" },
                { label: isFin ? "All appraisals" : isEl ? "People in my departments" : "In my team", value: rows.length },
                ...(share ? [{ label: "My team budget", value: inr(share.allocation), hint: `${inr(share.used)} proposed or approved · ${inr(share.remaining)} left` }] : []),
                ...(budget && "departments" in budget && budget.departments.length ? [{ label: isFin ? "Budgets given" : "Department budget", value: inr(budget.departments.reduce((t, d) => t + (d.budget ?? 0), 0)), hint: `${inr(budget.departments.reduce((t, d) => t + d.used, 0))} proposed or approved` }] : []),
            ]} />
            {(budget && (("departments" in budget && budget.departments.length > 0) || share)) && (
                <p className="text-sm text-ink-500 dark:text-ink-400">{isFin ? "Set each department's budget, and approve EL hikes, on the " : isEl ? "Give each FL a share of the budget on the " : "Your share was set by your EL. See it on the "}<Link to="/appraisal/budget" className="font-semibold text-brand-700 hover:underline dark:text-brand-400">Budget page</Link>.</p>
            )}

            <Panel flush title="Appraisals" actions={<Segmented size="sm" label="Show" value={filter} onChange={setFilter} options={[{ key: "todo", label: `Waiting for me (${todo.length})` }, { key: "all", label: "Everyone" }]} />}>
                {groups.length ? groups.map(([name, list]) => {
                    const line = flLine(name);
                    return (
                        <div key={name} className="border-b border-ink-200 last:border-0 dark:border-white/10">
                            {isEl && (
                                <div className="flex flex-wrap items-center justify-between gap-2 bg-ink-50 px-5 py-3 dark:bg-ink-800">
                                    <p className="text-sm font-bold text-ink-900 dark:text-white">{name}<span className="ml-2 text-xs font-normal text-ink-500">{list.length} {list.length === 1 ? "person" : "people"}</span></p>
                                    {line && (line.allocation > 0 || line.used > 0) && <p className="text-xs text-ink-600 dark:text-ink-300">Budget {inr(line.allocation)} · used {inr(line.used)} · <span className={line.remaining < 0 ? "font-semibold text-rose-600" : "font-semibold text-emerald-600"}>left {inr(line.remaining)}</span></p>}
                                </div>
                            )}
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[900px] text-sm">
                                    <thead><tr className="border-b border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">{HEAD.map((h, i) => <th key={h + i} className={cn("px-4 py-2.5", i === 1 || i === 2 || i === 3 ? "text-right" : "text-left")}>{h}</th>)}</tr></thead>
                                    <tbody>{list.map((r) => <Row key={r.cycleId} r={r} />)}</tbody>
                                </table>
                            </div>
                        </div>
                    );
                }) : <p className="px-4 py-12 text-center text-sm text-ink-500">{filter === "todo" ? "Nothing is waiting for you." : "Nobody in your team has an appraisal yet."}</p>}
            </Panel>
        </div>
    );
}
