import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@heroui/theme";
import { Check, Search } from "lucide-react";

import { Segmented } from "@/components/page";
import { Autocomplete, AutocompleteItem, Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from "@/components/ui";
import { USER_TYPES, userRoleLabel, userTypeLabel } from "@/components/access/userTypes";
import type { Candidate, DeptType, Person, Ref, SubDepartment } from "./api";

// Shared pieces of Department Management: ID and type tags, avatars, the people table and the person pickers.

export const CodeTag = ({ code, className }: { code: string | null; className?: string }) =>
    code ? <span className={cn("shrink-0 whitespace-nowrap bg-ink-900 px-1.5 py-0.5 text-[10.5px] font-bold tracking-[0.08em] text-white dark:bg-white dark:text-ink-900", className)}>{code}</span> : null;

export const TypeTag = ({ type }: { type: DeptType | null }) =>
    type ? (
        <span className={cn("px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em]", type === "BUSINESS" ? "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" : "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300")}>
            {type === "BUSINESS" ? "Business" : "Support"}
        </span>
    ) : null;

export const StatusText = ({ on }: { on: boolean }) => <span className={cn("text-xs font-bold", on ? "text-emerald-600 dark:text-emerald-400" : "text-ink-500")}>{on ? "Active" : "Inactive"}</span>;

const TONE: Record<string, string> = { SUPER_ADMIN: "bg-brand-800", ADMIN: "bg-brand-700", EL: "bg-ink-900 dark:bg-white dark:text-ink-900", FL: "bg-brand-500", MANAGER: "bg-ink-700", LEAD: "bg-ink-600" };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

export function Avatar({ name, userType, size = 32 }: { name: string; userType?: string | null; size?: number }) {
    return (
        <span aria-hidden style={{ width: size, height: size, fontSize: size * 0.36 }}
            className={cn("flex shrink-0 items-center justify-center font-bold text-white", TONE[userType ?? ""] ?? "bg-ink-400 dark:bg-ink-600")}>
            {initials(name)}
        </span>
    );
}

/** A number with its label, for the summary row of a department or sub department */
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
    return (
        <div className="min-w-0 px-5 py-4">
            <p className="eyebrow">{label}</p>
            <p className="mt-1.5 text-2xl font-bold leading-none text-ink-900 dark:text-white">{value}</p>
            {hint && <p className="mt-1.5 truncate text-xs text-ink-500 dark:text-ink-400">{hint}</p>}
        </div>
    );
}
export const StatRow = ({ children }: { children: ReactNode }) => (
    <div className="grid grid-cols-2 border-l border-t border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900 sm:grid-cols-3 lg:grid-cols-5 [&>*]:border-b [&>*]:border-r [&>*]:border-ink-200 dark:[&>*]:border-white/10">{children}</div>
);

export const SearchBox = ({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) => (
    <label className={cn("relative block", className)}>
        <span className="sr-only">{placeholder}</span>
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
            className="h-9 w-full border border-ink-200 bg-white pl-9 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500 dark:border-white/15 dark:bg-ink-900 dark:text-white" />
    </label>
);

const fmtDate = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Not set");
const cycleText = (c: string | null) => (c === "APRIL" ? "April" : c === "OCTOBER" ? "October" : "—");

/** People with their user type, sub department (when several), reporting line and status; filters on top */
export function PeopleTable({ people, subs, showSub, showCycle, onMove, actions, empty }: {
    people: Person[]; subs?: SubDepartment[]; showSub?: boolean; showCycle?: boolean;
    onMove?: (p: Person) => void; actions?: ReactNode; empty?: ReactNode;
}) {
    const [q, setQ] = useState("");
    const [sub, setSub] = useState("all");
    const [type, setType] = useState("all");
    const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
    const subOf = (id: number) => subs?.find((s) => s.id === id);
    const types = useMemo(() => USER_TYPES.filter((t) => people.some((p) => p.userType === t.key)), [people]);
    const shown = people.filter((p) =>
        (status === "all" || (status === "active") === p.active) && (sub === "all" || String(p.subDepartmentId) === sub) && (type === "all" || p.userType === type) &&
        (!q.trim() || `${p.name} ${p.email} ${p.employeeId ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())));
    const cols = ["Person", "Employee ID", "User type", ...(showSub ? ["Sub department"] : []), "Reports to", ...(showCycle ? ["Joined · cycle"] : []), "Status", ...(onMove ? [""] : [])];

    return (
        <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2.5 border-b border-ink-100 px-5 py-3 dark:border-white/5">
                <SearchBox value={q} onChange={setQ} placeholder="Find a person" className="w-full sm:w-56" />
                {showSub && subs && subs.length > 1 && (
                    <Select aria-label="Sub department" size="sm" className="w-48" selectedKeys={new Set([sub])} disallowEmptySelection onSelectionChange={(k) => setSub(String(Array.from(k)[0]))}>
                        {[<SelectItem key="all">All sub departments</SelectItem>, ...subs.map((s) => <SelectItem key={String(s.id)}>{s.name}</SelectItem>)]}
                    </Select>
                )}
                {types.length > 1 && (
                    <Select aria-label="User type" size="sm" className="w-44" selectedKeys={new Set([type])} disallowEmptySelection onSelectionChange={(k) => setType(String(Array.from(k)[0]))}>
                        {[<SelectItem key="all">All user types</SelectItem>, ...types.map((t) => <SelectItem key={t.key}>{t.label}</SelectItem>)]}
                    </Select>
                )}
                <Segmented size="sm" label="Status" value={status} onChange={setStatus} options={[{ key: "all", label: "All" }, { key: "active", label: "Active" }, { key: "inactive", label: "Inactive" }]} />
                <div className="ml-auto flex items-center gap-2">{actions}</div>
            </div>
            {!people.length ? (
                <div className="px-5 py-12 text-center text-sm text-ink-500 dark:text-ink-400">{empty ?? "Nobody here yet."}</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-ink-50 dark:bg-white/5">
                            <tr className="border-b border-ink-200 dark:border-white/10">{cols.map((c, i) => <th key={i} className="whitespace-nowrap px-4 py-2.5 text-left">{c}</th>)}</tr>
                        </thead>
                        <tbody>
                            {shown.map((p) => {
                                const s = subOf(p.subDepartmentId);
                                return (
                                    <tr key={`${p.userId}-${p.subDepartmentId}`} className={cn("border-b border-ink-100 last:border-0 hover:bg-ink-50/60 dark:border-white/5 dark:hover:bg-white/[0.03]", !p.active && "opacity-55")}>
                                        <td className="max-w-[260px] px-4 py-2.5">
                                            <div className="flex items-center gap-3">
                                                <Avatar name={p.name} userType={p.userType} />
                                                <div className="min-w-0">
                                                    <Link to={`/profile/${p.userId}`} className="block truncate font-semibold text-ink-900 hover:text-brand-600 hover:underline dark:text-white">{p.name}</Link>
                                                    <p className="truncate text-xs text-ink-500 dark:text-ink-400">{p.designation || p.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-2.5 text-ink-600 dark:text-ink-300">{p.employeeId || "—"}</td>
                                        <td className="px-4 py-2.5">
                                            <span className="text-ink-800 dark:text-ink-100">{userTypeLabel(p.userType, p.roleName)}</span>
                                            {p.userRole && <span className="ml-1.5 bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{userRoleLabel(p.userRole)}</span>}
                                        </td>
                                        {showSub && <td className="px-4 py-2.5">{s ? <Link to={`/departments/sub/${s.id}`} className="text-ink-700 hover:text-brand-600 hover:underline dark:text-ink-200"><span className="mr-1.5 text-[11px] font-bold text-ink-400">{s.code}</span>{s.name}</Link> : "—"}</td>}
                                        <td className="px-4 py-2.5 text-ink-600 dark:text-ink-300">{p.reportsTo?.name ?? "—"}</td>
                                        {showCycle && <td className="whitespace-nowrap px-4 py-2.5 text-ink-600 dark:text-ink-300">{fmtDate(p.joined)}<span className="block text-xs text-ink-500">{cycleText(p.appraisalCycle) === "—" ? "No cycle" : `${cycleText(p.appraisalCycle)} cycle`}</span></td>}
                                        <td className="px-4 py-2.5"><StatusText on={p.active} /></td>
                                        {onMove && <td className="py-2.5 pl-2 pr-4 text-right"><Button size="sm" variant="light" className="min-w-0 px-2.5" onPress={() => onMove(p)}>Move</Button></td>}
                                    </tr>
                                );
                            })}
                            {!shown.length && <tr><td colSpan={cols.length} className="px-4 py-10 text-center text-xs text-ink-500">Nobody matches.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

/** One person, searched by name (an Executive or Functional Leader) */
export function PersonField({ label, value, onChange, candidates, placeholder = "Choose a person", description, size }: {
    label?: string; value: number | null; onChange: (id: number | null) => void; candidates: Candidate[]; placeholder?: string; description?: string; size?: "sm" | "md";
}) {
    return (
        <Autocomplete label={label} aria-label={label ?? placeholder} labelPlacement="outside" placeholder={placeholder} size={size} description={description}
            selectedKey={value ? String(value) : null} onSelectionChange={(k) => onChange(k ? Number(k) : null)}>
            {candidates.filter((c) => c.active || c.userId === value).map((c) => <AutocompleteItem key={String(c.userId)} textValue={c.name}>{c.name}</AutocompleteItem>)}
        </Autocomplete>
    );
}

/** Choose several people to move into a sub department; people already in the department come first */
export function PeoplePicker({ open, title, note, candidates, suggested, subName, exclude, onClose, onPick }: {
    open: boolean; title: string; note?: string; candidates: Candidate[]; suggested?: number[]; subName: (id: number) => string | null;
    exclude?: number[]; onClose: () => void; onPick: (ids: number[]) => void | Promise<void>;
}) {
    const [q, setQ] = useState("");
    const [picked, setPicked] = useState<number[]>([]);
    const [busy, setBusy] = useState(false);
    const list = useMemo(() => {
        const s = new Set(suggested ?? []);
        const ex = new Set(exclude ?? []);
        return candidates.filter((c) => c.active && !ex.has(c.userId) && (!q.trim() || `${c.name} ${c.email}`.toLowerCase().includes(q.trim().toLowerCase())))
            .sort((a, b) => Number(s.has(b.userId)) - Number(s.has(a.userId)) || a.name.localeCompare(b.name)).slice(0, 80);
    }, [candidates, suggested, exclude, q]);
    const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    const close = () => { setQ(""); setPicked([]); onClose(); };

    return (
        <Modal isOpen={open} onOpenChange={(o) => !o && close()} size="lg" scrollBehavior="inside">
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1"><span className="eyebrow">People</span><span>{title}</span></ModalHeader>
                <ModalBody className="gap-3">
                    {note && <p className="text-xs text-ink-500 dark:text-ink-400">{note}</p>}
                    <SearchBox value={q} onChange={setQ} placeholder="Find someone by name or email" />
                    <ul className="flex flex-col divide-y divide-ink-100 border border-ink-200 dark:divide-white/5 dark:border-white/10">
                        {list.map((c) => {
                            const on = picked.includes(c.userId);
                            const now = c.subDepartmentIds.map(subName).filter(Boolean).join(", ");
                            return (
                                <li key={c.userId}>
                                    <button type="button" onClick={() => toggle(c.userId)} aria-pressed={on}
                                        className={cn("flex w-full items-center gap-3 px-3 py-2 text-left transition-colors", on ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-ink-50 dark:hover:bg-white/5")}>
                                        <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center border", on ? "border-brand-500 bg-brand-500 text-white" : "border-ink-300 dark:border-white/30")}>{on && <Check size={12} strokeWidth={3} />}</span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[13px] font-semibold text-ink-900 dark:text-white">{c.name}</span>
                                            <span className="block truncate text-[11px] text-ink-500 dark:text-ink-400">{now ? `Now in ${now}` : "In no sub department"}</span>
                                        </span>
                                        {suggested?.includes(c.userId) && <span className="text-[10px] font-bold uppercase tracking-wide text-ink-400">In this department</span>}
                                    </button>
                                </li>
                            );
                        })}
                        {!list.length && <li className="px-3 py-8 text-center text-xs text-ink-500">Nobody matches.</li>}
                    </ul>
                    <p className="text-xs text-ink-500 dark:text-ink-400">Each person belongs to one sub department, so they leave the one they are in now.</p>
                </ModalBody>
                <ModalFooter>
                    <Button variant="bordered" onPress={close}>Cancel</Button>
                    <Button color="primary" isDisabled={!picked.length} isLoading={busy}
                        onPress={async () => { setBusy(true); try { await onPick(picked); close(); } finally { setBusy(false); } }}>
                        {picked.length ? `Move ${picked.length} ${picked.length === 1 ? "person" : "people"} in` : "Choose people"}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

/** Move one person to another sub department */
export function MoveModal({ person, subs, onClose, onMove }: { person: Person | null; subs: { id: number; label: string }[]; onClose: () => void; onMove: (subId: number) => Promise<void> }) {
    const [to, setTo] = useState("");
    const [busy, setBusy] = useState(false);
    // not closed by outside clicks: picking from the list (drawn outside the dialog) counted as one and closed it
    return (
        <Modal isOpen={!!person} onOpenChange={(o) => { if (!o) { setTo(""); onClose(); } }} size="md" isDismissable={false}>
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1"><span className="eyebrow">Move person</span><span>{person?.name}</span></ModalHeader>
                <ModalBody>
                    <Autocomplete label="Move to sub department" labelPlacement="outside" placeholder="Search a sub department" selectedKey={to || null} onSelectionChange={(k) => setTo(k ? String(k) : "")}>
                        {subs.filter((s) => s.id !== person?.subDepartmentId).map((s) => <AutocompleteItem key={String(s.id)} textValue={s.label}>{s.label}</AutocompleteItem>)}
                    </Autocomplete>
                </ModalBody>
                <ModalFooter>
                    <Button variant="bordered" onPress={() => { setTo(""); onClose(); }}>Cancel</Button>
                    <Button color="primary" isDisabled={!to} isLoading={busy} onPress={async () => { setBusy(true); try { await onMove(Number(to)); setTo(""); onClose(); } finally { setBusy(false); } }}>Move</Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

export const leaderLine = (el: Ref | null, fl: Ref | null) => `EL ${el?.name ?? "not set"} · FL ${fl?.name ?? "not set"}`;
