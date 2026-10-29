import { useCallback, useEffect, useMemo, useState } from "react";
import { Spinner } from "@heroui/react";
import { Search } from "lucide-react";

import { Panel, SummaryBar } from "@/components/page";
import { Button, addToast } from "@/components/ui";
import { appraisalApi, errorText, type FinanceHead, type Level, type PersonSetup } from "./api";
import { LEVEL_LABEL, parseAmount, showAmount } from "./format";

const inputCls = "h-9 w-full border border-ink-200 bg-transparent px-2.5 text-[13px] text-ink-900 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-ink-900 dark:text-white";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

interface Draft { dateOfJoining: string; level: Level | ""; ctc: string }

function Row({ p, onSaved }: { p: PersonSetup; onSaved: () => void }) {
    const initial: Draft = { dateOfJoining: p.dateOfJoining ?? "", level: p.level ?? "", ctc: showAmount(p.currentAnnualCtc) };
    const [d, setD] = useState<Draft>(initial);
    const [busy, setBusy] = useState(false);
    useEffect(() => setD({ dateOfJoining: p.dateOfJoining ?? "", level: p.level ?? "", ctc: showAmount(p.currentAnnualCtc) }), [p]);
    const dirty = d.dateOfJoining !== initial.dateOfJoining || d.level !== initial.level || d.ctc !== initial.ctc;
    const save = async () => {
        setBusy(true);
        try { await appraisalApi.savePerson(p.userId, { dateOfJoining: d.dateOfJoining || null, level: d.level || null, currentAnnualCtc: parseAmount(d.ctc) }); addToast({ title: `Saved ${p.name}`, color: "success" }); onSaved(); }
        catch (e) { addToast({ title: "Could not save", description: errorText(e), color: "danger" }); }
        finally { setBusy(false); }
    };
    const start = async () => {
        setBusy(true);
        try { await appraisalApi.createCycle(p.userId, today()); addToast({ title: `Cycle started for ${p.name}`, color: "success" }); onSaved(); }
        catch (e) { addToast({ title: "Could not start a cycle", description: errorText(e), color: "danger" }); }
        finally { setBusy(false); }
    };
    return (
        <tr className="border-b border-ink-100 last:border-0 dark:border-white/5">
            <td className="px-4 py-2.5"><p className="font-semibold text-ink-900 dark:text-white">{p.name}</p><p className="text-xs text-ink-500">{p.roleName}</p></td>
            <td className="w-44 px-4 py-2.5"><input type="date" aria-label={`Joining date of ${p.name}`} className={inputCls} value={d.dateOfJoining} onChange={(e) => setD({ ...d, dateOfJoining: e.target.value })} /></td>
            <td className="w-48 px-4 py-2.5">
                <select aria-label={`Level of ${p.name}`} className={inputCls} value={d.level} onChange={(e) => setD({ ...d, level: e.target.value as Level | "" })}>
                    <option value="">Not set</option>
                    {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                </select>
            </td>
            <td className="w-44 px-4 py-2.5"><input aria-label={`Current annual CTC of ${p.name}`} inputMode="numeric" placeholder="₹ per year" className={inputCls} value={d.ctc} onChange={(e) => setD({ ...d, ctc: showAmount(parseAmount(e.target.value)) })} /></td>
            <td className="px-4 py-2.5 text-xs text-ink-500">{p.cycles}</td>
            <td className="px-4 py-2.5"><div className="flex justify-end gap-2">
                <Button size="sm" variant="light" isDisabled={busy || dirty || !p.level} onPress={start}>Start cycle</Button>
                <Button size="sm" color="primary" isLoading={busy} isDisabled={!dirty} onPress={save}>Save</Button>
            </div></td>
        </tr>
    );
}

const isAdmin = () => { try { return JSON.parse(localStorage.getItem("authUserLD") || "{}").userRole === 1; } catch { return false; } };

/** The Finance Head: gives each EL a budget, approves ELs' hikes and sees every appraisal. An Admin can change who it is. */
function FinanceHeadCard({ people }: { people: PersonSetup[] }) {
    const [head, setHead] = useState<FinanceHead | null>(null);
    const [pick, setPick] = useState("");
    const [busy, setBusy] = useState(false);
    useEffect(() => { appraisalApi.financeHead().then((h) => { setHead(h); setPick(h.userId ? String(h.userId) : ""); }).catch(() => setHead(null)); }, []);
    const admin = isAdmin();
    const save = async () => {
        setBusy(true);
        try { const h = await appraisalApi.setFinanceHead(Number(pick)); setHead(h); addToast({ title: `${h.name} is now the Finance Head`, color: "success" }); }
        catch (e) { addToast({ title: "Could not change the Finance Head", description: errorText(e), color: "danger" }); }
        finally { setBusy(false); }
    };
    return (
        <Panel title="Finance Head">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <p className="text-lg font-bold text-ink-900 dark:text-white">{head?.name ?? "Not set"}</p>
                    <p className="text-sm text-ink-500 dark:text-ink-400">
                        {head?.source === "department" ? `Head of ${head.department}. ` : head?.source === "setting" ? "Chosen in this setup. " : `Nobody leads ${head?.department ?? "Strategic Financial Management"} yet. `}
                        Gives each EL a budget, approves the ELs' hikes and sees every appraisal.
                    </p>
                </div>
                {admin && (
                    <div className="flex items-center gap-2">
                        <select aria-label="Finance Head" className={inputCls + " w-64"} value={pick} onChange={(e) => setPick(e.target.value)}>
                            <option value="">Choose a person</option>
                            {people.map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}
                        </select>
                        <Button color="primary" size="sm" isLoading={busy} isDisabled={!pick || Number(pick) === head?.userId} onPress={save}>Save</Button>
                    </div>
                )}
            </div>
        </Panel>
    );
}

// Appraisal setup: the joining date starts each person's yearly cycle; the level decides the fixed / variable split.
export default function PeopleSetup() {
    const [people, setPeople] = useState<PersonSetup[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const load = useCallback(async () => {
        try { setPeople(await appraisalApi.people()); }
        catch (e) { addToast({ title: "Could not load people", description: errorText(e), color: "danger" }); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const rows = useMemo(() => { const q = query.trim().toLowerCase(); return people.filter((p) => !q || p.name.toLowerCase().includes(q) || p.roleName.toLowerCase().includes(q)); }, [people, query]);
    if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
    const noJoin = people.filter((p) => !p.dateOfJoining).length;
    return (
        <div className="flex flex-col gap-6">
            <FinanceHeadCard people={people} />
            <SummaryBar className="mb-0" items={[{ label: "People", value: people.length }, { label: "Without a joining date", value: noJoin, hint: "No cycle starts for them" }, { label: "Without a level", value: people.filter((p) => !p.level).length, hint: "The split needs a level" }]} />
            <Panel flush title="Joining date, level and CTC" actions={
                <label className="relative block w-56">
                    <span className="sr-only">Find a person</span>
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a person" className="h-8 w-full border border-ink-200 bg-transparent pl-9 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500 dark:border-white/10 dark:text-white" />
                </label>}>
                <div className="max-h-[640px] overflow-auto">
                    <table className="w-full min-w-[860px] text-sm">
                        <thead className="sticky top-0 z-10"><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">{["Person", "Joining date", "Level", "Current CTC", "Cycles", ""].map((h) => <th key={h} className="px-4 py-2.5 text-left">{h}</th>)}</tr></thead>
                        <tbody>{rows.map((p) => <Row key={p.userId} p={p} onSaved={load} />)}{!rows.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-ink-500">Nobody matches.</td></tr>}</tbody>
                    </table>
                </div>
            </Panel>
        </div>
    );
}
