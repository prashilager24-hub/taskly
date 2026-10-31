import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "@heroui/react";
import { cn } from "@heroui/theme";
import { AlertTriangle, CheckCircle2, Download, Search, Upload } from "lucide-react";
import * as XLSX from "xlsx";

import { Panel, SummaryBar } from "@/components/page";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, addToast } from "@/components/ui";
import { appraisalApi, errorText, type CycleMonth, type FinanceHead, type Level, type PersonBody, type PersonSetup } from "./api";
import { LEVEL_LABEL, MAX_AMOUNT, day, inr, parseAmount, showAmount } from "./format";
import { StatusChip } from "./parts";

const inputCls = "h-9 w-full border border-ink-200 bg-transparent px-2.5 text-[13px] text-ink-900 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-ink-900 dark:text-white";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

// ── The April / October cycle (the server works it out the same way) ─────────────────────────────

/** Joined December to May: April cycle. Joined June to November: October cycle. */
const cycleMonthOf = (joined: string): CycleMonth => { const m = Number(joined.slice(5, 7)); return m >= 6 && m <= 11 ? "OCTOBER" : "APRIL"; };
const startIn = (month: CycleMonth, year: number) => `${year}-${month === "APRIL" ? "04" : "10"}-01`;
/** The latest 1 April / 1 October on or before today */
const currentStart = (month: CycleMonth, t: string) => { const s = startIn(month, Number(t.slice(0, 4))); return s <= t ? s : startIn(month, Number(t.slice(0, 4)) - 1); };
/** The first cycle start after both today and the joining date */
const nextStart = (month: CycleMonth, joined: string, t: string) => { let y = Number(t.slice(0, 4)); while (startIn(month, y) <= t || startIn(month, y) <= joined) y++; return startIn(month, y); };

const CycleTag = ({ month }: { month: CycleMonth | null }) => month
    ? <span className={cn("inline-flex px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider", month === "APRIL" ? "bg-sky-500/15 text-sky-700 dark:text-sky-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300")}>{month === "APRIL" ? "April" : "October"}</span>
    : <span className="text-xs text-ink-400">Needs joining date</span>;

/** Where the person's appraisal stands: running now, or when it will start */
function CycleState({ p, joined, level }: { p: PersonSetup; joined: string; level: Level | "" }) {
    if (!joined || !level) return <span className="text-xs text-ink-400">Needs {!joined && !level ? "joining date and level" : !joined ? "joining date" : "level"}</span>;
    const month = cycleMonthOf(joined);
    const t = today();
    const cur = currentStart(month, t);
    if (p.latestCycle && p.latestCycle.start >= cur) return <div className="flex flex-col items-start gap-1"><StatusChip status={p.latestCycle.status} /><span className="text-[11px] text-ink-500">Started {day(p.latestCycle.start)}</span></div>;
    if (joined < cur) return <span className="text-xs text-ink-500">Starts when saved ({day(cur)} cycle)</span>;
    return <span className="text-xs text-ink-500">First appraisal {day(nextStart(month, joined, t))}</span>;
}

interface Draft { dateOfJoining: string; level: Level | ""; ctc: string }
const draftOf = (p: PersonSetup): Draft => ({ dateOfJoining: p.dateOfJoining ?? "", level: p.level ?? "", ctc: showAmount(p.currentAnnualCtc) });

function Row({ p, onSaved }: { p: PersonSetup; onSaved: () => void }) {
    const [d, setD] = useState<Draft>(draftOf(p));
    const [busy, setBusy] = useState(false);
    useEffect(() => setD(draftOf(p)), [p]);
    const initial = draftOf(p);
    const dirty = d.dateOfJoining !== initial.dateOfJoining || d.level !== initial.level || d.ctc !== initial.ctc;
    const save = async () => {
        setBusy(true);
        try {
            const out = await appraisalApi.savePerson(p.userId, { dateOfJoining: d.dateOfJoining || null, level: d.level || null, currentAnnualCtc: parseAmount(d.ctc) });
            addToast({ title: `Saved ${p.name}`, description: out.cycleStarted ? "Their appraisal has started." : undefined, color: "success" });
            onSaved();
        } catch (e) { addToast({ title: "Could not save", description: errorText(e), color: "danger" }); }
        finally { setBusy(false); }
    };
    return (
        <tr className="border-b border-ink-100 last:border-0 dark:border-white/5">
            <td className="px-4 py-2.5"><p className="font-semibold text-ink-900 dark:text-white">{p.name}</p><p className="text-xs text-ink-500">{[p.employeeId, p.roleName].filter(Boolean).join(" · ")}</p></td>
            <td className="w-44 px-4 py-2.5"><input type="date" max={today()} aria-label={`Joining date of ${p.name}`} className={inputCls} value={d.dateOfJoining} onChange={(e) => setD({ ...d, dateOfJoining: e.target.value })} /></td>
            <td className="w-44 px-4 py-2.5">
                <select aria-label={`Level of ${p.name}`} className={inputCls} value={d.level} onChange={(e) => setD({ ...d, level: e.target.value as Level | "" })}>
                    <option value="">Not set</option>
                    {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                </select>
            </td>
            <td className="w-40 px-4 py-2.5"><input aria-label={`Current annual CTC of ${p.name}`} inputMode="numeric" placeholder="₹ per year" className={inputCls} value={d.ctc} onChange={(e) => setD({ ...d, ctc: showAmount(parseAmount(e.target.value)) })} /></td>
            <td className="px-4 py-2.5"><CycleTag month={d.dateOfJoining ? cycleMonthOf(d.dateOfJoining) : null} /></td>
            <td className="px-4 py-2.5"><CycleState p={p} joined={d.dateOfJoining} level={d.level} /></td>
            <td className="px-4 py-2.5 text-right"><Button size="sm" color="primary" isLoading={busy} isDisabled={!dirty} onPress={save}>Save</Button></td>
        </tr>
    );
}

// ── Bulk upload: template with everyone's current details, edited in Excel and uploaded back ──────

const COLS = { id: "Employee ID", name: "Name", email: "Email", joined: "Joining date (YYYY-MM-DD)", level: "Level", ctc: "Current CTC (₹ per year)", cycle: "Appraisal cycle (automatic)" };
const LEVEL_TEXT: Record<Level, string> = { ASSOCIATE: "Associate", MANAGER: "Manager / FL", HEAD_EL: "Head / EL" };

function downloadTemplate(people: PersonSetup[]) {
    const rows = people.map((p) => ({
        [COLS.id]: p.employeeId ?? "", [COLS.name]: p.name, [COLS.email]: p.email, [COLS.joined]: p.dateOfJoining ?? "",
        [COLS.level]: p.level ? LEVEL_TEXT[p.level] : "", [COLS.ctc]: p.currentAnnualCtc ?? "", [COLS.cycle]: p.cycleMonth ? (p.cycleMonth === "APRIL" ? "April" : "October") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows, { header: Object.values(COLS) });
    ws["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 34 }, { wch: 24 }, { wch: 16 }, { wch: 22 }, { wch: 26 }];
    const help = XLSX.utils.aoa_to_sheet([
        ["How to fill the Appraisal setup template"],
        [],
        ["1", "Edit the rows of the people you want to change. Rows are matched by Email (or Employee ID if the email is empty). Do not change those two columns."],
        ["2", "Joining date: YYYY-MM-DD, for example 2024-07-15. DD-MM-YYYY and Excel dates are also read."],
        ["3", "Level: Associate, Manager / FL, or Head / EL. It sets the variable share of the hike (10%, 20%, 30%)."],
        ["4", "Current CTC: the yearly amount in rupees, for example 850000."],
        ["5", "Leave a cell empty to keep what is saved today."],
        ["6", "Appraisal cycle is worked out from the joining date and is not read: joined December to May = April cycle, June to November = October cycle."],
        ["7", "Upload the file on the Appraisal setup page. You see every row checked before anything is saved."],
    ]);
    help["!cols"] = [{ wch: 4 }, { wch: 120 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "People");
    XLSX.utils.book_append_sheet(wb, help, "How to fill");
    XLSX.writeFile(wb, `appraisal-setup-template-${today()}.xlsx`);
}

const pad = (n: number) => String(n).padStart(2, "0");
const validDate = (y: number, m: number, d: number) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d && y > 1950; };

/** A joining date cell: an Excel date number, YYYY-MM-DD, or DD-MM-YYYY / DD/MM/YYYY */
function readDate(v: unknown): { value?: string; error?: string } {
    if (v === "" || v == null) return {};
    let y: number, m: number, d: number;
    if (typeof v === "number") { const c = XLSX.SSF.parse_date_code(v); if (!c) return { error: "Joining date is not a date" }; ({ y, m, d } = c); }
    else {
        const s = String(v).trim();
        const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
        if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
        else if (dmy) [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
        else return { error: `Joining date "${s}" is not YYYY-MM-DD` };
    }
    if (!validDate(y, m, d)) return { error: "Joining date is not a real date" };
    const value = `${y}-${pad(m)}-${pad(d)}`;
    if (value > today()) return { error: "Joining date is in the future" };
    return { value };
}

function readLevel(v: unknown): { value?: Level; error?: string } {
    const s = String(v ?? "").trim().toLowerCase();
    if (!s) return {};
    // "Executive Leader" before "Executive" (an associate role)
    if (/^(head|el\b|executive leader)/.test(s)) return { value: "HEAD_EL" };
    if (/^(manager|fl\b|functional|lead)/.test(s)) return { value: "MANAGER" };
    if (/^(associate|employee|intern|executive)/.test(s)) return { value: "ASSOCIATE" };
    return { error: `Level "${String(v).trim()}" is not Associate, Manager / FL or Head / EL` };
}

function readCtc(v: unknown): { value?: number; error?: string } {
    if (v === "" || v == null) return {};
    const n = typeof v === "number" ? v : Number(String(v).replace(/[₹,\s]/g, ""));
    if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) return { error: `Current CTC "${String(v).trim()}" is not an amount` };
    return { value: Math.round(n) };
}

interface Checked { line: number; person: PersonSetup | null; label: string; next: PersonBody | null; changed: boolean; errors: string[] }

/** Reads the uploaded sheet and checks every row against the people on the page; nothing is saved here */
async function checkFile(file: File, people: PersonSetup[]): Promise<Checked[]> {
    const wb = XLSX.read(await file.arrayBuffer());
    const ws = wb.Sheets[wb.SheetNames[0]];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
    const head = (grid[0] ?? []).map((h) => String(h).trim().toLowerCase());
    const col = (start: string) => head.findIndex((h) => h.startsWith(start));
    const at = { id: col("employee id"), name: col("name"), email: col("email"), joined: col("joining date"), level: col("level"), ctc: col("current ctc") };
    if (at.email < 0 && at.id < 0) throw new Error("The file has no Email or Employee ID column. Download the template and use that.");
    const byEmail = new Map(people.map((p) => [p.email.toLowerCase(), p]));
    const byId = new Map(people.filter((p) => p.employeeId).map((p) => [String(p.employeeId).trim().toLowerCase(), p]));
    const seen = new Set<number>();
    const out: Checked[] = [];
    grid.slice(1).forEach((r, i) => {
        const cell = (k: keyof typeof at) => (at[k] >= 0 ? r[at[k]] : "");
        if (r.every((c) => c === "" || c == null)) return;
        const email = String(cell("email")).trim().toLowerCase();
        const id = String(cell("id")).trim().toLowerCase();
        const person = (email && byEmail.get(email)) || (id && byId.get(id)) || null;
        const label = person?.name || String(cell("name")).trim() || email || id || "—";
        const errors: string[] = [];
        if (!person) errors.push(email || id ? "No active person with this email / employee ID" : "Email and Employee ID are empty");
        else if (seen.has(person.userId)) errors.push("This person is in the file twice");
        const joined = readDate(cell("joined")); const level = readLevel(cell("level")); const ctc = readCtc(cell("ctc"));
        for (const x of [joined, level, ctc]) if (x.error) errors.push(x.error);
        let next: PersonBody | null = null; let changed = false;
        if (person) {
            seen.add(person.userId);
            next = { dateOfJoining: joined.value ?? person.dateOfJoining, level: level.value ?? person.level, currentAnnualCtc: ctc.value ?? person.currentAnnualCtc };
            changed = next.dateOfJoining !== person.dateOfJoining || next.level !== person.level || next.currentAnnualCtc !== person.currentAnnualCtc;
        }
        out.push({ line: i + 2, person, label, next, changed, errors });
    });
    return out;
}

function UploadPreview({ rows, onClose, onDone }: { rows: Checked[] | null; onClose: () => void; onDone: () => void }) {
    const [busy, setBusy] = useState(false);
    const [onlyIssues, setOnlyIssues] = useState(false);
    const list = rows ?? [];
    const ready = list.filter((r) => !r.errors.length && r.changed);
    const bad = list.filter((r) => r.errors.length);
    const same = list.length - ready.length - bad.length;
    const shown = onlyIssues ? bad : [...bad, ...ready, ...list.filter((r) => !r.errors.length && !r.changed)];
    const apply = async () => {
        setBusy(true);
        try {
            const out = await appraisalApi.savePeople(ready.map((r) => ({ userId: r.person!.userId, ...r.next! })));
            addToast({ title: `Saved ${out.saved} ${out.saved === 1 ? "person" : "people"}`, description: [out.started ? `${out.started} appraisal${out.started === 1 ? "" : "s"} started.` : "", out.failed.length ? `${out.failed.length} could not be saved: ${out.failed[0].message}` : ""].filter(Boolean).join(" ") || undefined, color: out.failed.length ? "warning" : "success" });
            onDone();
        } catch (e) { addToast({ title: "Could not save the upload", description: errorText(e), color: "danger" }); }
        finally { setBusy(false); }
    };
    const cellCls = (on: boolean) => cn("px-3 py-2 tabular-nums", on && "font-semibold text-brand-700 dark:text-brand-400");
    return (
        <Modal isOpen={!!rows} onOpenChange={(o) => !o && onClose()} size="5xl" scrollBehavior="inside">
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">Check the upload<span className="text-sm font-normal text-ink-500">Nothing is saved until you press Save. Changed values are highlighted.</span></ModalHeader>
                <ModalBody>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="border border-emerald-500/40 bg-emerald-500/10 px-4 py-3"><p className="eyebrow">Will be saved</p><p className="mt-1 text-2xl font-bold text-ink-900 dark:text-white">{ready.length}</p></div>
                        <div className="border border-ink-200 px-4 py-3 dark:border-white/10"><p className="eyebrow">No change</p><p className="mt-1 text-2xl font-bold text-ink-900 dark:text-white">{same}</p></div>
                        <div className={cn("border px-4 py-3", bad.length ? "border-rose-500/40 bg-rose-500/10" : "border-ink-200 dark:border-white/10")}><p className="eyebrow">Need fixing (skipped)</p><p className="mt-1 text-2xl font-bold text-ink-900 dark:text-white">{bad.length}</p></div>
                    </div>
                    {bad.length > 0 && <label className="flex items-center gap-2 text-sm text-ink-600 dark:text-ink-300"><input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />Show only the rows that need fixing</label>}
                    <div className="overflow-x-auto border border-ink-200 dark:border-white/10">
                        <table className="w-full min-w-[820px] text-sm">
                            <thead><tr className="border-b border-ink-200 bg-ink-50 text-left dark:border-white/10 dark:bg-ink-800">{["Row", "Person", "Joining date", "Level", "Current CTC", "Cycle", "Result"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
                            <tbody>
                                {shown.map((r) => (
                                    <tr key={r.line} className="border-b border-ink-100 align-top last:border-0 dark:border-white/5">
                                        <td className="px-3 py-2 text-xs text-ink-500">{r.line}</td>
                                        <td className="px-3 py-2 font-semibold text-ink-900 dark:text-white">{r.label}</td>
                                        <td className={cellCls(!!r.person && r.next?.dateOfJoining !== r.person.dateOfJoining)}>{r.next?.dateOfJoining ? day(r.next.dateOfJoining) : "—"}</td>
                                        <td className={cellCls(!!r.person && r.next?.level !== r.person.level)}>{r.next?.level ? LEVEL_LABEL[r.next.level] : "—"}</td>
                                        <td className={cellCls(!!r.person && r.next?.currentAnnualCtc !== r.person.currentAnnualCtc)}>{r.next?.currentAnnualCtc != null ? inr(r.next.currentAnnualCtc) : "—"}</td>
                                        <td className="px-3 py-2"><CycleTag month={r.next?.dateOfJoining ? cycleMonthOf(r.next.dateOfJoining) : null} /></td>
                                        <td className="px-3 py-2">{r.errors.length
                                            ? <ul className="flex flex-col gap-0.5 text-xs text-rose-600 dark:text-rose-400">{r.errors.map((e) => <li key={e} className="flex gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{e}</li>)}</ul>
                                            : r.changed ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 size={13} />Will be saved</span> : <span className="text-xs text-ink-400">No change</span>}</td>
                                    </tr>
                                ))}
                                {!shown.length && <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-ink-500">The file has no rows.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant="bordered" onPress={onClose}>Cancel</Button>
                    <Button color="primary" isLoading={busy} isDisabled={!ready.length} onPress={apply}>Save {ready.length} {ready.length === 1 ? "person" : "people"}</Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

// ── Finance Head (an Admin chooses it) ────────────────────────────────────────────────────────────

const isAdmin = () => { try { return JSON.parse(localStorage.getItem("authUserLD") || "{}").userRole === 1; } catch { return false; } };

/** The Finance Head: gives each EL a budget and sees every appraisal. Only an Admin can change who it is, so only an Admin sees this. */
function FinanceHeadCard({ people }: { people: PersonSetup[] }) {
    const [head, setHead] = useState<FinanceHead | null>(null);
    const [pick, setPick] = useState("");
    const [busy, setBusy] = useState(false);
    useEffect(() => { appraisalApi.financeHead().then((h) => { setHead(h); setPick(h.userId ? String(h.userId) : ""); }).catch(() => setHead(null)); }, []);
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
                        Gives each EL a budget and sees every appraisal.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <select aria-label="Finance Head" className={inputCls + " w-64"} value={pick} onChange={(e) => setPick(e.target.value)}>
                        <option value="">Choose a person</option>
                        {people.map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}
                    </select>
                    <Button color="primary" size="sm" isLoading={busy} isDisabled={!pick || Number(pick) === head?.userId} onPress={save}>Save</Button>
                </div>
            </div>
        </Panel>
    );
}

// Appraisal setup (HR): joining date, level and current CTC. The joining date decides the April / October cycle,
// and the appraisal starts on its own when that cycle is due: saving is all it takes.
export default function PeopleSetup() {
    const [people, setPeople] = useState<PersonSetup[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [checked, setChecked] = useState<Checked[] | null>(null);
    const [reading, setReading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const load = useCallback(async () => {
        try { setPeople(await appraisalApi.people()); }
        catch (e) { addToast({ title: "Could not load people", description: errorText(e), color: "danger" }); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const rows = useMemo(() => { const q = query.trim().toLowerCase(); return people.filter((p) => !q || p.name.toLowerCase().includes(q) || p.roleName.toLowerCase().includes(q) || (p.employeeId ?? "").toLowerCase().includes(q)); }, [people, query]);
    const onFile = async (f: File | undefined) => {
        if (!f) return;
        setReading(true);
        try { setChecked(await checkFile(f, people)); }
        catch (e) { addToast({ title: "Could not read the file", description: e instanceof Error ? e.message : String(e), color: "danger" }); }
        finally { setReading(false); if (fileRef.current) fileRef.current.value = ""; }
    };

    if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
    return (
        <div className="flex flex-col gap-6">
            {isAdmin() && <FinanceHeadCard people={people} />}
            <SummaryBar className="mb-0" items={[
                { label: "People", value: people.length },
                { label: "April cycle", value: people.filter((p) => p.cycleMonth === "APRIL").length, hint: "Joined December to May" },
                { label: "October cycle", value: people.filter((p) => p.cycleMonth === "OCTOBER").length, hint: "Joined June to November" },
                { label: "Details missing", value: people.filter((p) => !p.dateOfJoining || !p.level).length, hint: "No appraisal starts without a joining date and level" },
            ]} />
            <Panel flush title="Joining date, level and CTC" actions={
                <div className="flex flex-wrap items-center gap-2">
                    <label className="relative block w-52">
                        <span className="sr-only">Find a person</span>
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a person" className="h-8 w-full border border-ink-200 bg-transparent pl-9 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500 dark:border-white/10 dark:text-white" />
                    </label>
                    <Button size="sm" variant="bordered" startContent={<Download size={14} />} onPress={() => downloadTemplate(people)}>Download template</Button>
                    <Button size="sm" color="primary" startContent={<Upload size={14} />} isLoading={reading} onPress={() => fileRef.current?.click()}>Bulk upload</Button>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                </div>}>
                <p className="border-b border-ink-200 px-5 py-3 text-xs text-ink-500 dark:border-white/10 dark:text-ink-400">Joined December to May: April cycle. Joined June to November: October cycle. The appraisal starts on its own when the cycle is due; just save the details.</p>
                <div className="max-h-[640px] overflow-auto">
                    <table className="w-full min-w-[980px] text-sm">
                        <thead className="sticky top-0 z-10"><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">{["Person", "Joining date", "Level", "Current CTC", "Appraisal cycle", "Appraisal", ""].map((h) => <th key={h} className="px-4 py-2.5 text-left">{h}</th>)}</tr></thead>
                        <tbody>{rows.map((p) => <Row key={p.userId} p={p} onSaved={load} />)}{!rows.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-500">Nobody matches.</td></tr>}</tbody>
                    </table>
                </div>
            </Panel>
            <UploadPreview rows={checked} onClose={() => setChecked(null)} onDone={() => { setChecked(null); load(); }} />
        </div>
    );
}
