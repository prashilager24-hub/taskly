import { useMemo, useState, type ReactNode } from "react";
import { Pencil, Plus, Power, Search } from "lucide-react";
import { cn } from "@heroui/theme";

import { Button } from "@/components/ui";
import { Segmented } from "@/components/page";

// Department list on the left, the selected department's items on the right.
// Used by Task, Target and Goal Management, and inside a sub department (Department Management) locked to that one.

export interface SplitColumn<T> { label: string; cell: (item: T) => ReactNode; className?: string }
export interface SplitDepartment { id: number; name: string }

/** "15" or "15 hrs"; the unit is dropped when it only repeats the number */
export const targetText = (value: unknown, unit: unknown) => {
    const v = value === null || value === undefined ? "" : String(value).trim();
    const u = (unit ?? "").toString().trim();
    if (!v) return u || "—";
    return !u || u === v ? v : `${v} ${u}`;
};

/** Fixed / Dynamic tag */
export const TypeTag = ({ dynamic }: { dynamic?: boolean }) =>
    dynamic
        ? <span className="bg-amber-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Dynamic</span>
        : <span className="text-xs text-ink-500 dark:text-ink-400">Fixed</span>;

interface Props<T> {
    noun: string;
    items: T[];
    departments: SplitDepartment[];
    loading?: boolean;
    deptOf: (item: T) => number;
    isActive: (item: T) => boolean;
    idOf: (item: T) => string | number;
    searchText: (item: T) => string;
    columns: SplitColumn<T>[];
    onAdd: (departmentId: number) => void;
    onEdit: (item: T) => void;
    onToggle: (item: T) => void;
    /** small amber dot beside a department, e.g. goals waiting to be acknowledged */
    flagCount?: (items: T[]) => number;
    flagLabel?: string;
    /** shown after the count line, e.g. "3 acknowledged · 1 waiting" */
    summaryExtra?: (items: T[]) => string;
    /** extra buttons in the department header */
    headerExtra?: (items: T[]) => ReactNode;
    /** extra buttons at the end of a row */
    rowExtra?: (item: T) => ReactNode;
    /** only this department: no department list, and the panel grows with its rows (inside a sub department page) */
    lockedDepartment?: number;
}

export default function DepartmentSplit<T>(p: Props<T>) {
    const [query, setQuery] = useState("");
    const [active, setActive] = useState<number | null>(null);
    const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
    const [find, setFind] = useState("");

    // every department, plus any an item belongs to that the list did not return
    const departments = useMemo(() => {
        const byId = new Map<number, SplitDepartment>(p.departments.map((d) => [d.id, d]));
        for (const i of p.items) { const id = p.deptOf(i); if (id && !byId.has(id)) byId.set(id, { id, name: `Department ${id}` }); }
        return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [p.departments, p.items]);

    const itemsOf = (id: number) => p.items.filter((i) => p.deptOf(i) === id);
    const shown = departments.filter((d) => !query.trim() || d.name.toLowerCase().includes(query.trim().toLowerCase()));
    const locked = p.lockedDepartment;
    const dept = locked != null
        ? departments.find((d) => d.id === locked) ?? { id: locked, name: "" }
        : departments.find((d) => d.id === active) ?? departments.find((d) => itemsOf(d.id).length) ?? departments[0] ?? null;
    const all = dept ? itemsOf(dept.id) : [];
    const rows = all
        .filter((i) => status === "all" || (status === "active") === p.isActive(i))
        .filter((i) => !find.trim() || p.searchText(i).toLowerCase().includes(find.trim().toLowerCase()));
    const activeCount = all.filter(p.isActive).length;
    const plural = (n: number) => `${n} ${n === 1 ? p.noun : `${p.noun}s`}`;

    if (p.loading) return <p className="py-16 text-center text-sm text-ink-500">Loading {p.noun}s…</p>;
    if (locked == null && !departments.length) return <p className="border border-dashed border-ink-300 py-16 text-center text-sm text-ink-500 dark:border-white/20">No departments found.</p>;

    return (
        <div className={cn("grid grid-cols-1 border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900", locked == null && "min-h-[480px] lg:h-[calc(100vh-240px)] lg:min-h-[460px] lg:grid-cols-[270px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]")}>
            {/* Departments */}
            {locked == null && <aside className="flex max-h-[420px] min-h-0 flex-col border-b border-ink-200 dark:border-white/10 lg:border-b-0 lg:border-r">
                <div className="border-b border-ink-100 p-3 dark:border-white/5">
                    <label className="relative block">
                        <span className="sr-only">Find a department</span>
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a department"
                            className="h-8 w-full border border-ink-200 bg-transparent pl-9 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500 dark:border-white/15 dark:text-white" />
                    </label>
                </div>
                <ul className="min-h-0 flex-1 overflow-y-auto py-1">
                    {shown.map((d) => {
                        const on = d.id === dept?.id;
                        const list = itemsOf(d.id);
                        const flags = p.flagCount ? p.flagCount(list) : 0;
                        return (
                            <li key={d.id}>
                                <button type="button" onClick={() => { setActive(d.id); setFind(""); }}
                                    className={cn("relative flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] transition-colors focus-ring", on ? "bg-ink-50 font-semibold text-ink-900 dark:bg-white/5 dark:text-white" : "text-ink-600 hover:bg-ink-50/70 dark:text-ink-300 dark:hover:bg-white/[0.03]")}>
                                    <span className={cn("absolute inset-y-1.5 left-0 w-[3px]", on ? "bg-brand-600" : "bg-transparent")} aria-hidden />
                                    <span className="min-w-0 flex-1 truncate" title={d.name}>{d.name}</span>
                                    {flags > 0 && <span className="h-1.5 w-1.5 shrink-0 bg-amber-500" title={`${flags} ${p.flagLabel ?? "need attention"}`} aria-label={`${flags} ${p.flagLabel ?? "need attention"}`} />}
                                    <span className={cn("shrink-0 text-[11px]", list.length ? "text-ink-400" : "text-ink-300 dark:text-ink-600")}>{list.length}</span>
                                </button>
                            </li>
                        );
                    })}
                    {!shown.length && <li className="px-4 py-6 text-center text-xs text-ink-500">No department matches.</li>}
                </ul>
            </aside>}

            {/* Items of the department */}
            <section className="flex min-h-0 min-w-0 flex-col">
                {dept && (
                    <>
                        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-5 py-3.5 dark:border-white/10">
                            <div className="min-w-0">
                                <h2 className="truncate text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">{locked != null ? `${p.noun}s` : dept.name}</h2>
                                <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                                    {plural(all.length)} · {activeCount} active · {all.length - activeCount} inactive{p.summaryExtra ? ` · ${p.summaryExtra(all)}` : ""}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {p.headerExtra?.(all)}
                                <Button size="sm" color="primary" startContent={<Plus size={14} />} onPress={() => p.onAdd(dept.id)}>Add {p.noun}</Button>
                            </div>
                        </header>

                        {all.length > 0 && (
                            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-2.5 dark:border-white/5">
                                <label className="relative block w-full max-w-xs">
                                    <span className="sr-only">Search {p.noun}s</span>
                                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                                    <input value={find} onChange={(e) => setFind(e.target.value)} placeholder={`Search ${p.noun}s`}
                                        className="h-8 w-full border border-ink-200 bg-transparent pl-9 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500 dark:border-white/15 dark:text-white" />
                                </label>
                                <Segmented size="sm" label="Status" value={status} onChange={setStatus}
                                    options={[{ key: "all", label: "All" }, { key: "active", label: "Active" }, { key: "inactive", label: "Inactive" }]} />
                            </div>
                        )}

                        {all.length === 0 ? (
                            <div className="px-5 py-14 text-center">
                                <p className="text-sm text-ink-500 dark:text-ink-400">No {p.noun}s in this department yet.</p>
                                <Button className="mt-4" size="sm" color="primary" startContent={<Plus size={14} />} onPress={() => p.onAdd(dept.id)}>Add {p.noun}</Button>
                            </div>
                        ) : (
                            <div className={cn("min-h-0 flex-1", locked == null ? "overflow-auto" : "overflow-x-auto")}>
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 z-10 bg-ink-50 dark:bg-ink-800">
                                        <tr className="border-b border-ink-200 dark:border-white/10">
                                            {p.columns.map((c) => <th key={c.label} className="px-4 py-2.5 text-left">{c.label}</th>)}
                                            <th className="px-4 py-2.5 text-left">Status</th>
                                            <th className="px-4 py-2.5 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((i) => {
                                            const on = p.isActive(i);
                                            return (
                                                <tr key={p.idOf(i)} className={cn("border-b border-ink-100 last:border-0 hover:bg-ink-50/60 dark:border-white/5 dark:hover:bg-white/[0.03]", !on && "opacity-60")}>
                                                    {p.columns.map((c) => <td key={c.label} className={cn("px-4 py-3 text-ink-600 dark:text-ink-300", c.className)}>{c.cell(i)}</td>)}
                                                    <td className="px-4 py-3">
                                                        <span className={cn("text-xs font-bold", on ? "text-emerald-600 dark:text-emerald-400" : "text-ink-500")}>{on ? "Active" : "Inactive"}</span>
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-3 text-right">
                                                        <span className="inline-flex items-center justify-end gap-1">
                                                            {p.rowExtra?.(i)}
                                                            <Button isIconOnly size="sm" variant="light" aria-label={`Edit ${p.noun}`} title="Edit" onPress={() => p.onEdit(i)}><Pencil size={15} /></Button>
                                                            <Button isIconOnly size="sm" variant="light" color={on ? "danger" : "success"} aria-label={on ? `Deactivate ${p.noun}` : `Activate ${p.noun}`} title={on ? "Deactivate" : "Activate"} onPress={() => p.onToggle(i)}><Power size={15} /></Button>
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {!rows.length && <tr><td colSpan={p.columns.length + 2} className="px-4 py-10 text-center text-xs text-ink-500">No {p.noun}s match.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
