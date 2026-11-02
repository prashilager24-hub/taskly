import { Fragment, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@heroui/theme";
import { ArrowRight, ChevronDown, ChevronRight, LayoutGrid, Rows3, TriangleAlert } from "lucide-react";

import { Segmented } from "@/components/page";
import { Button } from "@/components/ui";
import { criteriaLabel, type Department, type SubDepartment } from "./api";
import { CodeTag, SearchBox, Stat, StatRow, StatusText, TypeTag } from "./parts";

/** Departments tab: totals, the older sub departments to place, and every department as cards or an expandable table */
export default function ListView({ departments, subs, canWrite, onMap }: { departments: Department[]; subs: SubDepartment[]; canWrite: boolean; onMap: () => void }) {
    const navigate = useNavigate();
    const [view, setView] = useState<"cards" | "table">(() => { try { return localStorage.getItem("deptmgmt.view") === "table" ? "table" : "cards"; } catch { return "cards"; } });
    const [q, setQ] = useState("");
    const [type, setType] = useState<"all" | "BUSINESS" | "SUPPORT">("all");
    const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
    const [open, setOpen] = useState<Set<number>>(new Set());
    const pickView = (v: "cards" | "table") => { setView(v); try { localStorage.setItem("deptmgmt.view", v); } catch { /* not kept */ } };

    const loose = subs.filter((s) => !s.departmentId);
    const mapped = subs.filter((s) => s.departmentId);
    const text = q.trim().toLowerCase();
    const shown = useMemo(() => departments.filter((d) => {
        if (type !== "all" && d.type !== type) return false;
        if (status !== "all" && (status === "active") !== d.active) return false;
        if (!text) return true;
        return `${d.code} ${d.name}`.toLowerCase().includes(text) || subs.some((s) => s.departmentId === d.id && `${s.code} ${s.name}`.toLowerCase().includes(text));
    }), [departments, subs, type, status, text]);
    const subsOf = (id: number) => subs.filter((s) => s.departmentId === id && !(s.isTeam && subs.filter((x) => x.departmentId === id).length === 1));
    const toggle = (id: number) => setOpen((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    // a search that hits a sub department opens its department in the table
    const isOpen = (id: number) => open.has(id) || (!!text && subsOf(id).some((s) => `${s.code} ${s.name}`.toLowerCase().includes(text)));

    const business = departments.filter((d) => d.type === "BUSINESS").length;
    const tot = (k: "tasks" | "targets" | "goals") => mapped.reduce((n, s) => n + s[k], 0);

    return (
        <div className="flex flex-col gap-5">
            <StatRow>
                <Stat label="Departments" value={departments.length} hint={`${business} business · ${departments.length - business} support`} />
                <Stat label="Sub departments" value={subs.length} hint={loose.length ? `${loose.length} not under a department` : "All under a department"} />
                <Stat label="People" value={mapped.reduce((n, s) => n + s.activePeople, 0)} hint="Active" />
                <Stat label="Tasks · Targets" value={`${tot("tasks")} · ${tot("targets")}`} hint="Active" />
                <Stat label="Goals" value={tot("goals")} hint="Active" />
            </StatRow>

            {loose.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <TriangleAlert size={18} className="shrink-0 text-amber-600" />
                    <p className="min-w-0 flex-1 text-sm text-ink-800 dark:text-ink-100">
                        <b>{loose.length} sub departments are not under any department</b> ({loose.slice(0, 5).map((s) => s.name).join(", ")}{loose.length > 5 ? " …" : ""}). Place each one in its department so its people and data show up here.
                    </p>
                    {canWrite && <Button size="sm" color="primary" onPress={onMap}>Place them</Button>}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
                <SearchBox value={q} onChange={setQ} placeholder="Find a department or sub department" className="w-full sm:w-72" />
                <Segmented size="sm" label="Type" value={type} onChange={setType} options={[{ key: "all", label: "All" }, { key: "BUSINESS", label: "Business" }, { key: "SUPPORT", label: "Support" }]} />
                <Segmented size="sm" label="Status" value={status} onChange={setStatus} options={[{ key: "active", label: "Active" }, { key: "inactive", label: "Inactive" }, { key: "all", label: "All" }]} />
                <div className="ml-auto">
                    <Segmented size="sm" label="View" value={view} onChange={pickView} options={[{ key: "cards", label: <span className="inline-flex items-center gap-1.5"><LayoutGrid size={13} />Cards</span> }, { key: "table", label: <span className="inline-flex items-center gap-1.5"><Rows3 size={13} />Table</span> }]} />
                </div>
            </div>

            {!shown.length ? (
                <p className="border border-dashed border-ink-300 py-16 text-center text-sm text-ink-500 dark:border-white/20">No department matches.</p>
            ) : view === "cards" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {shown.map((d) => (
                        <Link key={d.id} to={`/departments/${d.id}`}
                            className={cn("group flex flex-col border border-ink-200 bg-white p-5 transition-colors hover:border-ink-900 dark:border-white/10 dark:bg-ink-900 dark:hover:border-white/40", !d.active && "opacity-60")}>
                            <div className="flex items-center justify-between gap-2"><CodeTag code={d.code} /><span className="flex items-center gap-2">{!d.active && <StatusText on={false} />}<TypeTag type={d.type} /></span></div>
                            <h3 className="mt-3 line-clamp-2 min-h-[2.5rem] text-[15px] font-bold leading-5 text-ink-900 dark:text-white">{d.name}</h3>
                            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                <dt className="text-ink-500 dark:text-ink-400">Goal criteria</dt><dt className="text-ink-500 dark:text-ink-400">Target criteria</dt>
                                <dd className="font-semibold text-ink-800 dark:text-ink-100">{criteriaLabel(d.goalCriteria)}</dd><dd className="font-semibold text-ink-800 dark:text-ink-100">{criteriaLabel(d.targetCriteria)}</dd>
                            </dl>
                            <div className="mt-4 flex items-center gap-4 border-t border-ink-100 pt-3 text-xs text-ink-600 dark:border-white/5 dark:text-ink-300">
                                <span><b className="text-ink-900 dark:text-white">{d.singleTeam ? "One team" : d.subDepartments}</b>{d.singleTeam ? "" : ` sub ${d.subDepartments === 1 ? "dept" : "depts"}`}</span>
                                <span><b className="text-ink-900 dark:text-white">{d.activePeople}</b> people</span>
                                <span className="ml-auto inline-flex items-center gap-1 font-bold uppercase tracking-wide text-brand-600 group-hover:gap-2 transition-all">Open <ArrowRight size={13} /></span>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="overflow-x-auto border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
                    <table className="w-full text-sm">
                        <thead className="bg-ink-50 dark:bg-white/5">
                            <tr className="border-b border-ink-200 dark:border-white/10">
                                {["ID", "Department / sub department", "EL · FL", "Sub depts", "People", "Status", ""].map((h, i) => <th key={i} className="whitespace-nowrap px-4 py-2.5 text-left">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {shown.map((d) => {
                                const own = subsOf(d.id);
                                const expanded = isOpen(d.id);
                                return (
                                    <Fragment key={d.id}>
                                        <tr className={cn("border-b border-ink-200 bg-ink-50/50 dark:border-white/10 dark:bg-white/[0.03]", !d.active && "opacity-60")}>
                                            <td className="w-[92px] px-4 py-3 align-top"><CodeTag code={d.code} /></td>
                                            <td className="px-4 py-3">
                                                <button type="button" onClick={() => own.length && toggle(d.id)} aria-expanded={expanded} disabled={!own.length}
                                                    className="flex items-start gap-1.5 text-left font-bold text-ink-900 disabled:cursor-default dark:text-white">
                                                    <span className="mt-0.5 w-[15px] shrink-0">{own.length ? (expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />) : null}</span>{d.name}
                                                </button>
                                                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-[21px] text-xs text-ink-500 dark:text-ink-400"><TypeTag type={d.type} />Goals {criteriaLabel(d.goalCriteria).toLowerCase()} · Targets {criteriaLabel(d.targetCriteria).toLowerCase()}</p>
                                            </td>
                                            <td className="px-4 py-3 text-ink-400">—</td>
                                            <td className="px-4 py-3">{d.singleTeam ? "One team" : d.subDepartments}</td>
                                            <td className="px-4 py-3">{d.activePeople}</td>
                                            <td className="px-4 py-3"><StatusText on={d.active} /></td>
                                            <td className="px-4 py-3 text-right"><Button size="sm" variant="light" className="min-w-0 px-2.5 text-brand-600" onPress={() => navigate(`/departments/${d.id}`)}>Open</Button></td>
                                        </tr>
                                        {expanded && own.map((s) => (
                                            <tr key={s.id} className={cn("border-b border-ink-100 dark:border-white/5", !s.active && "opacity-60")}>
                                                <td className="px-4 py-2.5 pl-6"><span className="whitespace-nowrap text-[11px] font-bold tracking-wide text-ink-500">{s.code}</span></td>
                                                <td className="px-4 py-2.5">
                                                    <span className="flex flex-wrap items-baseline gap-x-2 pl-[21px]"><span className="text-ink-300" aria-hidden>└</span><span className="text-ink-900 dark:text-white">{s.name}</span>
                                                        <span className="text-xs text-ink-400">{[s.tasks && `${s.tasks} ${s.tasks === 1 ? "task" : "tasks"}`, s.targets && `${s.targets} ${s.targets === 1 ? "target" : "targets"}`, s.goals && `${s.goals} ${s.goals === 1 ? "goal" : "goals"}`].filter(Boolean).join(" · ") || "no data yet"}</span></span>
                                                </td>
                                                <td className="max-w-[200px] truncate px-4 py-2.5 text-xs text-ink-600 dark:text-ink-300" title={`${s.el?.name ?? "—"} · ${s.fl?.name ?? "—"}`}>{s.el?.name ?? "—"} · {s.fl?.name ?? "—"}</td>
                                                <td className="px-4 py-2.5 text-ink-400">—</td>
                                                <td className="px-4 py-2.5">{s.activePeople}</td>
                                                <td className="px-4 py-2.5"><StatusText on={s.active} /></td>
                                                <td className="px-4 py-2.5 text-right"><Button size="sm" variant="light" className="min-w-0 px-2.5" onPress={() => navigate(`/departments/sub/${s.id}`)}>Open</Button></td>
                                            </tr>
                                        ))}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
