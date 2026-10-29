import { cn } from "@heroui/theme";

import { ACTIONS, type Action, type ModuleDef, type ModuleExplain, type Privileges } from "./api";

const LABEL: Record<Action, string> = { read: "View", create: "Create", update: "Edit", delete: "Delete" };

/** Any change action needs View, so ticking one ticks View too and clearing View clears them all */
function toggle(current: Action[], action: Action): Action[] {
    const set = new Set(current);
    if (set.has(action)) {
        if (action === "read") set.clear();
        else set.delete(action);
    } else {
        set.add(action);
        set.add("read");
    }
    return ACTIONS.filter((a) => set.has(a));
}

const rows = (catalog: ModuleDef[]) => catalog.flatMap((m) => [{ mod: m, child: false }, ...(m.children ?? []).map((c) => ({ mod: c, child: true }))]);

const Cell = ({ on, onClick, disabled, label }: { on: boolean; onClick: () => void; disabled?: boolean; label: string }) => (
    <button
        type="button"
        role="checkbox"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={cn(
            "mx-auto flex h-6 w-6 items-center justify-center border text-[11px] font-bold transition-colors focus-ring",
            on ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300 bg-white text-transparent hover:border-brand-500 dark:border-white/20 dark:bg-ink-900",
            disabled && "cursor-not-allowed opacity-50",
        )}
    >
        ✓
    </button>
);

/** Modules down the side, View / Create / Edit / Delete across. Used for roles and departments. */
export default function PermissionMatrix({ catalog, value, onChange, readOnly }: { catalog: ModuleDef[]; value: Privileges; onChange: (next: Privileges) => void; readOnly?: boolean }) {
    const set = (id: string, acts: Action[]) => {
        const next = { ...value };
        if (acts.length) next[id] = acts; else delete next[id];
        onChange(next);
    };
    const all = rows(catalog);
    const setAll = (acts: Action[]) => onChange(Object.fromEntries(all.map((r) => [r.mod.id, acts]).filter(([, a]) => (a as Action[]).length)) as Privileges);

    return (
        <div className="border border-ink-200 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 bg-ink-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                <span className="eyebrow">Module access</span>
                {!readOnly && (
                    <div className="flex gap-3 text-[11px] font-bold uppercase tracking-wide">
                        <button type="button" className="text-brand-600 hover:underline focus-ring" onClick={() => setAll([...ACTIONS])}>Full access</button>
                        <button type="button" className="text-brand-600 hover:underline focus-ring" onClick={() => setAll(["read"])}>View only</button>
                        <button type="button" className="text-ink-500 hover:underline focus-ring" onClick={() => setAll([])}>Clear</button>
                    </div>
                )}
            </div>
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-ink-200 dark:border-white/10">
                        <th className="px-3 py-2 text-left">Module</th>
                        {ACTIONS.map((a) => <th key={a} className="w-16 px-1 py-2 text-center">{LABEL[a]}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {all.map(({ mod, child }) => {
                        const acts = value[mod.id] ?? [];
                        return (
                            <tr key={mod.id} className="border-b border-ink-100 last:border-0 dark:border-white/5">
                                <td className={cn("px-3 py-2", child && "pl-8")}>
                                    <p className={cn("font-medium text-ink-900 dark:text-white", !child && "font-semibold")}>{mod.label}</p>
                                    <p className="text-xs text-ink-500 dark:text-ink-400">{mod.description}</p>
                                </td>
                                {ACTIONS.map((a) => (
                                    <td key={a} className="px-1 py-2">
                                        <Cell on={acts.includes(a)} disabled={readOnly} label={`${mod.label} ${LABEL[a]}`} onClick={() => set(mod.id, toggle(acts, a))} />
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ── A person's own access: shows what they inherit and lets an admin add or take away ───────────

type CellState = "inherited" | "granted" | "denied" | "none";

/**
 * For one person: each cell shows where it comes from. Clicking an inherited cell takes it away (red);
 * clicking an empty cell gives it (green); clicking again goes back to "as inherited".
 */
export function UserAccessMatrix({ catalog, explain, grants, denies, onChange }: { catalog: ModuleDef[]; explain: ModuleExplain[]; grants: Privileges; denies: Privileges; onChange: (grants: Privileges, denies: Privileges) => void }) {
    const byId = new Map(explain.map((m) => [m.id, m]));
    const stateOf = (id: string, a: Action): CellState => {
        const m = byId.get(id);
        const inherited = !!m && (m.role.includes(a) || m.department.includes(a));
        if (denies[id]?.includes(a)) return "denied";
        if (grants[id]?.includes(a)) return "granted";
        return inherited ? "inherited" : "none";
    };
    const flip = (id: string, a: Action) => {
        const s = stateOf(id, a);
        const g = { ...grants }, d = { ...denies };
        const put = (map: Privileges, add: boolean) => {
            const cur = new Set(map[id] ?? []);
            if (add) cur.add(a); else cur.delete(a);
            if (cur.size) map[id] = ACTIONS.filter((x) => cur.has(x)); else delete map[id];
        };
        const m = byId.get(id);
        const inheritedActs = ACTIONS.filter((x) => !!m && (m.role.includes(x) || m.department.includes(x)));
        if (s === "inherited") {
            if (a === "read") d[id] = inheritedActs; // taking away View takes away everything in the module
            else put(d, true);
        } else if (s === "denied") {
            if (a === "read") delete d[id]; else put(d, false);
        } else if (s === "none") put(g, true);
        else put(g, false);
        onChange(g, d);
    };

    const style: Record<CellState, string> = {
        inherited: "border-ink-300 bg-ink-100 text-ink-600 dark:border-white/20 dark:bg-white/10 dark:text-ink-200",
        granted: "border-emerald-600 bg-emerald-600 text-white",
        denied: "border-rose-600 bg-rose-600 text-white",
        none: "border-ink-300 bg-white text-transparent hover:border-brand-500 dark:border-white/20 dark:bg-ink-900",
    };
    const glyph: Record<CellState, string> = { inherited: "✓", granted: "+", denied: "−", none: "·" };

    return (
        <div className="border border-ink-200 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-ink-200 bg-ink-50 px-3 py-2 text-[11px] dark:border-white/10 dark:bg-white/5">
                <span className="eyebrow">Legend</span>
                <span className="flex items-center gap-1.5"><span className={cn("flex h-4 w-4 items-center justify-center border text-[10px] font-bold", style.inherited)}>✓</span> From role / department</span>
                <span className="flex items-center gap-1.5"><span className={cn("flex h-4 w-4 items-center justify-center border text-[10px] font-bold", style.granted)}>+</span> Added for this person</span>
                <span className="flex items-center gap-1.5"><span className={cn("flex h-4 w-4 items-center justify-center border text-[10px] font-bold", style.denied)}>−</span> Taken away</span>
            </div>
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-ink-200 dark:border-white/10">
                        <th className="px-3 py-2 text-left">Module</th>
                        {ACTIONS.map((a) => <th key={a} className="w-16 px-1 py-2 text-center">{LABEL[a]}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {rows(catalog).map(({ mod, child }) => (
                        <tr key={mod.id} className="border-b border-ink-100 last:border-0 dark:border-white/5">
                            <td className={cn("px-3 py-2 font-medium text-ink-900 dark:text-white", child ? "pl-8" : "font-semibold")}>{mod.label}</td>
                            {ACTIONS.map((a) => {
                                const s = stateOf(mod.id, a);
                                return (
                                    <td key={a} className="px-1 py-2">
                                        <button type="button" aria-label={`${mod.label} ${LABEL[a]}: ${s}`} onClick={() => flip(mod.id, a)}
                                            className={cn("mx-auto flex h-6 w-6 items-center justify-center border text-[12px] font-bold transition-colors focus-ring", style[s])}>
                                            {glyph[s]}
                                        </button>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
