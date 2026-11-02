import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@heroui/theme";
import { ChevronDown, ChevronRight } from "lucide-react";

import { userTypeLabel } from "@/components/access/userTypes";
import { deptApi, type Department, type Person, type SubDepartment } from "./api";
import { Avatar, CodeTag, SearchBox } from "./parts";

/** Hierarchy tab: departments → sub departments (who leads them) on the left, the chosen one's reporting lines on the right */
export default function HierarchyView({ departments, subs }: { departments: Department[]; subs: SubDepartment[] }) {
    const [open, setOpen] = useState<Set<number>>(() => new Set(departments[0] ? [departments[0].id] : []));
    const [chosen, setChosen] = useState<number | null>(() => subs.find((s) => s.departmentId === departments[0]?.id && s.people)?.id ?? null);
    const [people, setPeople] = useState<Person[] | null>(null);
    const [q, setQ] = useState("");
    const sub = subs.find((s) => s.id === chosen) ?? null;

    useEffect(() => {
        if (!chosen) { setPeople(null); return; }
        setPeople(null);
        deptApi.subDepartment(chosen).then((r) => setPeople(r.people)).catch(() => setPeople([]));
    }, [chosen]);

    const text = q.trim().toLowerCase();
    const groups = [...departments.map((d) => ({ d, own: subs.filter((s) => s.departmentId === d.id) })), { d: null, own: subs.filter((s) => !s.departmentId) }]
        .map((g) => ({ ...g, own: g.own.filter((s) => !text || `${s.code} ${s.name} ${g.d?.name ?? ""}`.toLowerCase().includes(text)) }))
        .filter((g) => g.own.length);
    const toggle = (id: number) => setOpen((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

    // reporting lines inside the sub department: people whose manager is not here start a line
    const tree = useMemo(() => {
        if (!people) return [];
        const here = new Set(people.map((p) => p.userId));
        const kids = new Map<number, Person[]>();
        for (const p of people) if (p.reportsTo && here.has(p.reportsTo.userId) && p.reportsTo.userId !== p.userId) kids.set(p.reportsTo.userId, [...(kids.get(p.reportsTo.userId) ?? []), p]);
        const out: { p: Person; depth: number }[] = [];
        const seen = new Set<number>();
        const walk = (p: Person, depth: number) => { if (seen.has(p.userId)) return; seen.add(p.userId); out.push({ p, depth }); for (const k of kids.get(p.userId) ?? []) walk(k, depth + 1); };
        const roots = people.filter((p) => !p.reportsTo || !here.has(p.reportsTo.userId) || p.reportsTo.userId === p.userId);
        const rank = (p: Person) => (p.userId === sub?.el?.userId ? 0 : p.userId === sub?.fl?.userId ? 1 : 2);
        for (const r of roots.sort((a, b) => rank(a) - rank(b) || Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))) walk(r, 0);
        for (const p of people) walk(p, 0);
        return out;
    }, [people, sub]);

    return (
        <div className="grid grid-cols-1 border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <section className="flex min-h-0 flex-col border-b border-ink-200 dark:border-white/10 lg:max-h-[calc(100vh-260px)] lg:border-b-0 lg:border-r">
                <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-5 py-3 dark:border-white/5">
                    <div><p className="text-sm font-black tracking-[0.18em] text-ink-900 dark:text-white">TAPMIND</p><p className="text-xs text-ink-500">{departments.length} departments · {subs.length} sub departments</p></div>
                    <SearchBox value={q} onChange={setQ} placeholder="Find" className="ml-auto w-48" />
                </div>
                <ul className="min-h-0 flex-1 overflow-y-auto py-2">
                    {groups.map(({ d, own }) => {
                        const key = d?.id ?? 0;
                        const expanded = !!text || open.has(key);
                        return (
                            <li key={key}>
                                <button type="button" onClick={() => toggle(key)} aria-expanded={expanded} className="flex w-full items-center gap-2.5 px-5 py-2 text-left hover:bg-ink-50 dark:hover:bg-white/5">
                                    {expanded ? <ChevronDown size={15} className="text-ink-400" /> : <ChevronRight size={15} className="text-ink-400" />}
                                    {d ? <CodeTag code={d.code} /> : <span className="bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-amber-800">None</span>}
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[13px] font-bold text-ink-900 dark:text-white">{d?.name ?? "Not under a department"}</span>
                                        <span className="block text-[11px] text-ink-500">{d ? `${d.type === "SUPPORT" ? "Support" : "Business"} · ` : ""}{own.length} sub {own.length === 1 ? "dept" : "depts"} · {own.reduce((n, s) => n + s.activePeople, 0)} people</span>
                                    </span>
                                </button>
                                {expanded && (
                                    <ul className="ml-[29px] border-l border-ink-200 dark:border-white/10">
                                        {own.map((s) => {
                                            const on = s.id === chosen;
                                            return (
                                                <li key={s.id}>
                                                    <button type="button" onClick={() => setChosen(s.id)} aria-pressed={on}
                                                        className={cn("relative flex w-full items-center gap-2.5 py-2 pl-5 pr-5 text-left transition-colors", on ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-ink-50 dark:hover:bg-white/5", !s.active && "opacity-55")}>
                                                        <span className="absolute left-0 top-1/2 h-px w-3.5 bg-ink-200 dark:bg-white/10" aria-hidden />
                                                        <span className="text-[11px] font-bold tracking-wide text-ink-500">{s.code}</span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className={cn("block truncate text-[13px] font-semibold", on ? "text-brand-700 dark:text-brand-300" : "text-ink-900 dark:text-white")}>{s.name}</span>
                                                            <span className="block truncate text-[11px] text-ink-500">EL {s.el?.name ?? "—"}{s.fl ? ` · FL ${s.fl.name}` : ""} · {s.activePeople} people</span>
                                                        </span>
                                                        {on && <span className="text-[10px] font-bold uppercase tracking-wide text-brand-600">Shown</span>}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                    {!groups.length && <li className="px-5 py-10 text-center text-xs text-ink-500">Nothing matches.</li>}
                </ul>
            </section>

            <section className="flex min-h-[320px] flex-col lg:max-h-[calc(100vh-260px)]">
                <div className="border-b border-ink-100 px-5 py-3 dark:border-white/5">
                    <p className="eyebrow">Reporting lines</p>
                    {sub ? <Link to={`/departments/sub/${sub.id}`} className="mt-0.5 block text-sm font-bold text-ink-900 hover:text-brand-600 dark:text-white">{sub.code} · {sub.name}</Link> : <p className="mt-0.5 text-sm text-ink-500">Choose a sub department</p>}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
                    {!sub ? null : !people ? <p className="py-10 text-center text-xs text-ink-500">Loading…</p> : !people.length ? <p className="py-10 text-center text-xs text-ink-500">Nobody in this sub department yet.</p> : (
                        <ul className="flex flex-col">
                            {tree.map(({ p, depth }) => (
                                <li key={p.userId} className={cn("flex items-center gap-3 py-1.5", !p.active && "opacity-50")} style={{ paddingLeft: depth * 22 }}>
                                    {depth > 0 && <span className="-ml-3 h-px w-3 bg-ink-300 dark:bg-white/20" aria-hidden />}
                                    <Avatar name={p.name} userType={p.userType} size={30} />
                                    <span className="min-w-0 flex-1">
                                        <Link to={`/profile/${p.userId}`} className="block truncate text-[13px] font-semibold text-ink-900 hover:text-brand-600 dark:text-white">{p.name}</Link>
                                        {(p.employeeId || p.designation || (p.reportsTo && depth === 0) || !p.active) && <span className="block truncate text-[11px] text-ink-500">{[p.employeeId, p.designation, p.reportsTo && depth === 0 ? `reports to ${p.reportsTo.name}` : null, p.active ? null : "inactive"].filter(Boolean).join(" · ")}</span>}
                                    </span>
                                    <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-wide text-ink-500">{userTypeLabel(p.userType, p.roleName)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <p className="border-t border-ink-100 px-5 py-2.5 text-[11px] text-ink-500 dark:border-white/5">Reporting lines come from each person's reporting manager. Inactive people are greyed out.</p>
            </section>
        </div>
    );
}
