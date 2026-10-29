"use client";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Check, Search } from "lucide-react";
import { cn } from "@heroui/theme";

import { Button, addToast } from "@/components/ui";

interface Goal {
    goalID: number; departmentID: number; departmentName: string; goalName: string; goalMetric?: string; metricValue?: number | string;
    unit?: string; frequency?: string; isDynamic?: boolean; isActive?: boolean; approvedByEL?: boolean; archived?: boolean;
}
interface DeptGroup { departmentID: number; departmentName: string; goals: Goal[] }

const API = "/t2.0/authentificationUtilization";
/** "15" or "15 hrs"; the unit is dropped when it only repeats the number */
const target = (g: Goal) => {
    const v = g.metricValue === null || g.metricValue === undefined ? "" : String(g.metricValue).trim();
    const u = (g.unit ?? "").toString().trim();
    if (!v) return u || "—";
    return !u || u === v ? v : `${v} ${u}`;
};
const readUser = () => { try { return JSON.parse(localStorage.getItem("authUserLD") || "null"); } catch { return null; } };

// Goals per department. People see the departments they work in or lead; Super Admin sees all.
// Executive Leaders (role 3) acknowledge goals, one at a time or all pending in a department.
export default function GoalSetting() {
    const authUser = useMemo(readUser, []);
    const headers = useMemo(() => ({ "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${authUser?.token ?? ""}` }), [authUser]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);
    const [active, setActive] = useState<number | null>(null);
    const [query, setQuery] = useState("");
    const [saving, setSaving] = useState(false);

    const load = async () => {
        try {
            const { data } = await axios.post(`${API}/departmentGoals/list?page=0&size=0`, { departmentId: 0, searchText: "", filter: "", startDate: "", endDate: "" }, { headers });
            const mapped: Goal[] = (data?.response?.goals ?? []).map((g: any) => ({
                goalID: g.goalID, departmentID: g.departmentID, departmentName: g.departmentName, goalName: g.goalName, goalMetric: g.goalMetric,
                metricValue: g.metricValue, unit: g.unit, frequency: g.frequency, isDynamic: g.isDynamic, isActive: g.isActive,
                approvedByEL: g.approvedByEL, archived: g.isDepartmentArchived,
            }));
            setGoals(mapped.filter((g) => g.isActive && !g.archived));
        } catch (e) {
            addToast({ title: "Could not load goals", color: "danger" });
        }
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const visible = (d: DeptGroup) => {
        const mine = (authUser?.departments ?? []).some((x: any) => x.departmentID === d.departmentID);
        if (authUser?.userRole === 3 || authUser?.userRole === 4) return mine;
        if (authUser?.userRole === 2) return authUser?.departmentID === d.departmentID;
        return true;
    };

    const departments = useMemo<DeptGroup[]>(() => {
        const map = new Map<number, DeptGroup>();
        goals.forEach((g) => {
            if (!g.departmentID) return;
            const d = map.get(g.departmentID) ?? { departmentID: g.departmentID, departmentName: g.departmentName, goals: [] };
            d.goals.push(g);
            map.set(g.departmentID, d);
        });
        return [...map.values()].filter(visible).sort((a, b) => a.departmentName.localeCompare(b.departmentName));
    }, [goals, authUser]);

    const shown = departments.filter((d) => !query.trim() || d.departmentName.toLowerCase().includes(query.trim().toLowerCase()));
    const dept = departments.find((d) => d.departmentID === active) ?? departments[0] ?? null;
    const pending = dept?.goals.filter((g) => !g.approvedByEL) ?? [];
    const canAcknowledge = authUser?.userRole === 3;

    const acknowledge = async (ids: number[]) => {
        setSaving(true);
        try {
            await axios.put(`${API}/departmentGoals/approve`, { goalIds: ids, userId: authUser.userID }, { headers });
            addToast({ title: "Goals acknowledged", color: "success" });
            await load();
        } catch {
            addToast({ title: "Could not acknowledge goals", color: "danger" });
        }
        setSaving(false);
    };

    if (loading) return <p className="py-16 text-center text-sm text-ink-500">Loading goals…</p>;
    if (!departments.length) return <p className="border border-dashed border-ink-300 py-16 text-center text-sm text-ink-500 dark:border-white/20">No goals are set for your departments yet.</p>;

    return (
        <div className="grid min-h-[480px] grid-cols-1 border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900 lg:grid-cols-[270px_minmax(0,1fr)]">
            {/* Departments */}
            <aside className="flex min-h-0 flex-col border-b border-ink-200 dark:border-white/10 lg:border-b-0 lg:border-r">
                <div className="border-b border-ink-100 p-3 dark:border-white/5">
                    <label className="relative block">
                        <span className="sr-only">Find a department</span>
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a department"
                            className="h-8 w-full border border-ink-200 bg-transparent pl-9 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500 dark:border-white/10 dark:text-white" />
                    </label>
                </div>
                <ul className="max-h-[560px] flex-1 overflow-y-auto py-1">
                    {shown.map((d) => {
                        const on = d.departmentID === dept?.departmentID;
                        const waiting = d.goals.filter((g) => !g.approvedByEL).length;
                        return (
                            <li key={d.departmentID}>
                                <button type="button" onClick={() => setActive(d.departmentID)}
                                    className={cn("relative flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] transition-colors focus-ring", on ? "bg-ink-50 font-semibold text-ink-900 dark:bg-white/5 dark:text-white" : "text-ink-600 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-white/[0.03]")}>
                                    <span className={cn("absolute inset-y-1.5 left-0 w-[3px]", on ? "bg-brand-600" : "bg-transparent")} aria-hidden />
                                    <span className="min-w-0 flex-1 truncate" title={d.departmentName}>{d.departmentName}</span>
                                    {waiting > 0 && <span className="h-1.5 w-1.5 shrink-0 bg-amber-500" title={`${waiting} not acknowledged`} aria-label={`${waiting} not acknowledged`} />}
                                    <span className="shrink-0 text-[11px] text-ink-400">{d.goals.length}</span>
                                </button>
                            </li>
                        );
                    })}
                    {!shown.length && <li className="px-4 py-6 text-center text-xs text-ink-500">No department matches.</li>}
                </ul>
            </aside>

            {/* Goals */}
            <section className="min-w-0">
                {dept && (
                    <>
                        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-5 py-3.5 dark:border-white/10">
                            <div className="min-w-0">
                                <h2 className="truncate text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">{dept.departmentName}</h2>
                                <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                                    {dept.goals.length} {dept.goals.length === 1 ? "goal" : "goals"} · {dept.goals.length - pending.length} acknowledged · {pending.length} waiting
                                </p>
                            </div>
                            {canAcknowledge && pending.length > 0 && (
                                <Button size="sm" color="primary" isLoading={saving} startContent={<Check size={14} />} onPress={() => acknowledge(pending.map((g) => g.goalID))}>
                                    Acknowledge {pending.length} pending
                                </Button>
                            )}
                        </header>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-white/5">
                                        {["Goal", "Measured by", "Target", "How often", "Type", "Status"].map((h) => <th key={h} className="px-4 py-2.5 text-left">{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {dept.goals.map((g) => (
                                        <tr key={g.goalID} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/60 dark:border-white/5 dark:hover:bg-white/[0.03]">
                                            <td className="min-w-[220px] max-w-[360px] whitespace-normal break-words px-4 py-3 font-semibold text-ink-900 dark:text-white">{g.goalName || "Untitled"}</td>
                                            <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{g.goalMetric || "—"}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-ink-900 dark:text-white">{target(g)}</td>
                                            <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{g.frequency || "—"}</td>
                                            <td className="px-4 py-3">{g.isDynamic ? <span className="bg-amber-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Dynamic</span> : <span className="text-xs text-ink-500">Fixed</span>}</td>
                                            <td className="px-4 py-3">
                                                {g.approvedByEL
                                                    ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400"><Check size={13} /> Acknowledged</span>
                                                    : canAcknowledge
                                                        ? <button type="button" onClick={() => acknowledge([g.goalID])} className="text-xs font-bold uppercase tracking-wide text-brand-600 hover:underline focus-ring">Acknowledge</button>
                                                        : <span className="text-xs font-semibold text-amber-600">Waiting</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
