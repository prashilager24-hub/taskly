import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@heroui/theme";

import { Segmented } from "@/components/page";
import { addToast } from "@/components/ui";
import { accessApi, errorText, type HierarchyData, type HierarchyPerson, type Level } from "./api";

const LEVEL_NAME: Record<Level, string> = { admin: "Admin", el: "Executive Leader", fl: "FL / Manager / Lead", employee: "Employee", intern: "Intern" };

const Ref = ({ r, none }: { r: { name: string } | null; none: string }) =>
    r ? <span className="font-medium text-ink-900 dark:text-white">{r.name}</span> : <span className="text-xs text-ink-400">{none}</span>;

// The reporting ladder and who reviews whom. Assessors follow the ladder automatically; the manager and EL
// set on a person (Users tab, edit) take priority over the department's leaders.
export default function HierarchyTab() {
    const [data, setData] = useState<HierarchyData | null>(null);
    const [level, setLevel] = useState<Level | "all" | "missing">("all");
    const [query, setQuery] = useState("");

    const load = useCallback(() => {
        accessApi.hierarchy().then(setData).catch((e) => addToast({ title: "Could not load the hierarchy", description: errorText(e), color: "danger" }));
    }, []);
    useEffect(load, [load]);

    const admins = useMemo(() => (data?.people ?? []).filter((p) => p.level === "admin" && !/^superadmin/i.test(p.email)), [data]);
    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (data?.people ?? []).filter((p) =>
            (level === "all" || (level === "missing" ? p.missing : p.level === level)) &&
            (!q || p.name.toLowerCase().includes(q) || p.departments.some((d) => d.toLowerCase().includes(q))));
    }, [data, level, query]);

    const changeCeo = async (id: number) => {
        try { setData(await accessApi.setCeo(id)); addToast({ title: "CEO / CBO updated", color: "success" }); }
        catch (e) { addToast({ title: "Could not change", description: errorText(e), color: "danger" }); }
    };

    return (
        <div className="flex flex-col gap-6">
            {/* The ladder */}
            <ol className="grid grid-cols-1 border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900 sm:grid-cols-2 xl:grid-cols-5">
                {(data?.levels ?? []).map((l, i) => (
                    <li key={l.key} className={cn("flex flex-col gap-1 px-5 py-4", i > 0 && "border-t border-ink-200 dark:border-white/10 xl:border-l xl:border-t-0")}>
                        <span className="eyebrow">Level {i + 1}</span>
                        <p className="text-sm font-bold text-ink-900 dark:text-white">{l.label}</p>
                        <p className="text-[28px] font-bold leading-none text-ink-900 dark:text-white">{l.count}</p>
                        <p className="text-xs leading-snug text-ink-500 dark:text-ink-400">{l.description}</p>
                    </li>
                ))}
            </ol>

            {/* Rules + CEO */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                <section className="border border-ink-200 bg-white p-5 dark:border-white/10 dark:bg-ink-900">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">Who reviews whom</h2>
                    <dl className="mt-3 divide-y divide-ink-100 text-sm dark:divide-white/5">
                        {[
                            ["Employee, Intern", "Manager / Functional Leader", "Executive Leader"],
                            ["Functional Leader, Manager, Lead", "Executive Leader of their departments", "CEO / CBO (optional)"],
                            ["Executive Leader", "CEO / CBO", "None"],
                        ].map(([who, a1, a2]) => (
                            <div key={who} className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[200px_1fr_1fr] sm:gap-4">
                                <dt className="font-semibold text-ink-900 dark:text-white">{who}</dt>
                                <dd className="text-ink-600 dark:text-ink-300"><span className="eyebrow mr-2">Accessor 1</span>{a1}</dd>
                                <dd className="text-ink-600 dark:text-ink-300"><span className="eyebrow mr-2">Accessor 2</span>{a2}</dd>
                            </div>
                        ))}
                    </dl>
                </section>

                <section className="border border-ink-200 bg-white p-5 dark:border-white/10 dark:bg-ink-900">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">CEO / CBO</h2>
                    <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">The Admin account that reviews Executive Leaders.</p>
                    <label className="mt-3 block">
                        <span className="sr-only">CEO / CBO</span>
                        <select value={data?.ceo?.userId ?? ""} onChange={(e) => changeCeo(Number(e.target.value))}
                            className="h-9 w-full border border-ink-200 bg-transparent px-3 text-sm text-ink-900 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-ink-900 dark:text-white">
                            {!data?.ceo && <option value="">Choose an Admin</option>}
                            {admins.map((a) => <option key={a.userId} value={a.userId}>{a.name}</option>)}
                        </select>
                    </label>
                </section>
            </div>

            {/* People */}
            <section className="border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-5 py-3 dark:border-white/10">
                    <Segmented size="sm" label="Level" value={level} onChange={setLevel}
                        options={[{ key: "all", label: "Everyone" }, { key: "el", label: "EL" }, { key: "fl", label: "FL / Mgr" }, { key: "employee", label: "Employees" }, { key: "intern", label: "Interns" }, ...(data?.missing ? [{ key: "missing" as const, label: `No accessor (${data.missing})` }] : [])]} />
                    <label className="relative block w-full sm:w-64">
                        <span className="sr-only">Find a person or department</span>
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a person or department"
                            className="h-8 w-full border border-ink-200 bg-transparent pl-9 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500 dark:border-white/10 dark:text-white" />
                    </label>
                </div>
                <div className="max-h-[560px] overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">
                                {["Person", "Level", "Departments", "Accessor 1", "Accessor 2"].map((h) => <th key={h} className="px-4 py-2.5 text-left">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((p: HierarchyPerson) => (
                                <tr key={p.userId} className="border-b border-ink-100 last:border-0 dark:border-white/5">
                                    <td className="px-4 py-2.5"><p className="font-semibold text-ink-900 dark:text-white">{p.name}</p><p className="text-xs text-ink-500 dark:text-ink-400">{p.roleName}</p></td>
                                    <td className="px-4 py-2.5 text-xs text-ink-600 dark:text-ink-300">{LEVEL_NAME[p.level]}</td>
                                    <td className="max-w-[240px] truncate px-4 py-2.5 text-xs text-ink-600 dark:text-ink-300" title={p.departments.join(", ")}>{p.departments.join(", ") || "—"}</td>
                                    <td className="px-4 py-2.5">{p.level === "admin" ? <span className="text-xs text-ink-400">Not reviewed</span> : <Ref r={p.accessor1} none="Not set" />}</td>
                                    <td className="px-4 py-2.5">{p.accessor2Allowed || p.accessor2 ? <Ref r={p.accessor2} none={p.level === "fl" ? "None (optional)" : "Not set"} /> : <span className="text-xs text-ink-400">None</span>}</td>
                                </tr>
                            ))}
                            {!rows.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-ink-500">Nobody matches.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
