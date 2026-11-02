import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ChevronDown, ChevronRight, MoreVertical, Plus, Search } from "lucide-react";
import { cn } from "@heroui/theme";

import { PageHeader, Segmented } from "@/components/page";
import {
    Autocomplete, AutocompleteItem, Button, Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger,
    Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, addToast,
} from "@/components/ui";
import PrimaryDepartmentPage from "@/pages/PrimaryDepartment";

// One Departments page: every department with its sub departments listed under it, one Add control and one
// actions menu per row. The hierarchy chart is the second view.

const API = "/t2.0/authentificationUtilization";
const CRITERIA = [["DAILY", "Daily"], ["WEEKLY", "Weekly"], ["MONTHLY", "Monthly"], ["QUARTERLY", "Quarterly"], ["COMBINED", "Combined"]];
const NONE = "__none";

interface Primary { id: number; name: string; type: "BUSINESS" | "SUPPORT"; goalCriteria: string; targetCriteria: string; active: boolean }
interface Sub { id: number; name: string; description: string; active: boolean; primaryId: number | null; elId: string; elName: string; flId: string; flName: string }
interface Person { id: string; name: string }
type Drawer_ = { kind: "primary" | "sub"; id?: number; primaryId?: number | null } | null;
type Confirm = { kind: "primary" | "sub"; id: number; name: string; action: "toggle" | "delete"; to?: boolean } | null;

const readUser = () => { try { return JSON.parse(localStorage.getItem("authUserLD") || "null"); } catch { return null; } };
const typeChip = (t: Primary["type"]) => (
    <span className={cn("px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide", t === "BUSINESS" ? "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" : "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300")}>
        {t === "BUSINESS" ? "Business" : "Support"}
    </span>
);
const statusText = (on: boolean) => <span className={cn("text-xs font-bold", on ? "text-emerald-600 dark:text-emerald-400" : "text-ink-500")}>{on ? "Active" : "Inactive"}</span>;

export default function DepartmentsPage() {
    const user = useMemo(readUser, []);
    const headers = useMemo(() => ({ "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${user?.token ?? ""}` }), [user]);

    const [view, setView] = useState<"table" | "chart">("table");
    const [primaries, setPrimaries] = useState<Primary[]>([]);
    const [subs, setSubs] = useState<Sub[]>([]);
    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [type, setType] = useState<"all" | "BUSINESS" | "SUPPORT">("all");
    const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
    const [closed, setClosed] = useState<Set<number>>(new Set());
    const [drawer, setDrawer] = useState<Drawer_>(null);
    const [confirm, setConfirm] = useState<Confirm>(null);
    const [saving, setSaving] = useState(false);

    // form
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [pType, setPType] = useState<Primary["type"]>("BUSINESS");
    const [goalCriteria, setGoalCriteria] = useState("DAILY");
    const [targetCriteria, setTargetCriteria] = useState("DAILY");
    const [parent, setParent] = useState<string>(NONE);
    const [el, setEl] = useState("");
    const [fl, setFl] = useState("");

    const load = useCallback(async () => {
        try {
            const [p, d] = await Promise.all([
                axios.post(`${API}/PrimaryDepartment/list`, {}, { headers }),
                axios.post(`${API}/Department/list?page=0&size=0`, { searchText: "", filter: "", startDate: "", endDate: "", roleID: user?.userRole, userID: user?.isHeExecutiveLeader ? Number(user.userID) : 0 }, { headers }),
            ]);
            setPrimaries((p.data?.data ?? []).map((x: any): Primary => ({ id: x.primaryDepartmentId, name: x.primaryDepartmentName, type: x.type, goalCriteria: x.goalCriteria || "DAILY", targetCriteria: x.targetCriteria || "DAILY", active: !!x.active })));
            setSubs((d.data?.response?.departments ?? []).filter((x: any) => !x.isDepartmentArchived).map((x: any): Sub => ({
                id: x.departmentID, name: x.departmentName, description: x.departmentDescription ?? "", active: !!x.departmentStatus, primaryId: x.primaryDepartmentId ?? null,
                elId: String(x.executiveLeaderID ?? ""), elName: x.executiveLeaderName ?? "", flId: String(x.functionalLeaderID ?? ""), flName: x.functionalLeaderName ?? "",
            })));
        } catch {
            addToast({ title: "Could not load departments", color: "danger" });
        }
        setLoading(false);
    }, [headers, user]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        axios.post(`${API}/users/read?page=0&size=0`, { filter: "", searchText: "", departmentID: null }, { headers })
            .then((r) => setPeople((r.data?.response?.users ?? []).map((u: any) => ({ id: String(u.userID), name: u.userName }))))
            .catch(() => setPeople([]));
    }, [headers]);

    // ── what is shown ────────────────────────────────────────────────────────────────────────────
    const q = query.trim().toLowerCase();
    const groups = useMemo(() => {
        const statusOk = (on: boolean) => status === "all" || (status === "active") === on;
        const textHit = (s: Sub) => !q || [s.name, s.elName, s.flName, s.description].some((t) => t.toLowerCase().includes(q));
        const list = [...primaries].sort((a, b) => a.name.localeCompare(b.name)).filter((p) => type === "all" || p.type === type).map((p) => {
            const own = subs.filter((s) => s.primaryId === p.id).sort((a, b) => a.name.localeCompare(b.name));
            const nameHit = !q || p.name.toLowerCase().includes(q);
            // a department that matches the search shows all its sub departments; otherwise only the ones that match
            const rows = own.filter((s) => statusOk(s.active) && (nameHit || textHit(s)));
            return { primary: p, total: own.length, rows, show: (nameHit && statusOk(p.active)) || rows.length > 0 };
        }).filter((g) => g.show);
        const loose = type === "all"
            ? subs.filter((s) => !s.primaryId || !primaries.some((p) => p.id === s.primaryId)).sort((a, b) => a.name.localeCompare(b.name)).filter((s) => statusOk(s.active) && textHit(s))
            : [];
        return { list, loose };
    }, [primaries, subs, q, type, status]);

    const toggle = (id: number) => setClosed((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

    // ── forms ────────────────────────────────────────────────────────────────────────────────────
    const open = (next: NonNullable<Drawer_>) => {
        const p = next.kind === "primary" ? primaries.find((x) => x.id === next.id) : null;
        const s = next.kind === "sub" ? subs.find((x) => x.id === next.id) : null;
        setName(p?.name ?? s?.name ?? "");
        setDescription(s?.description ?? "");
        setPType(p?.type ?? "BUSINESS");
        setGoalCriteria(p?.goalCriteria ?? "DAILY");
        setTargetCriteria(p?.targetCriteria ?? "DAILY");
        setParent(s ? (s.primaryId ? String(s.primaryId) : NONE) : next.primaryId ? String(next.primaryId) : NONE);
        setEl(s?.elId ?? ""); setFl(s?.flId ?? "");
        setDrawer(next);
    };

    const done = (title: string) => { addToast({ title, color: "success" }); setDrawer(null); return load(); };
    const fail = (title: string, e: any) => addToast({ title, description: e?.response?.status === 409 ? "That name already exists." : undefined, color: "danger" });

    const save = async () => {
        if (!drawer || !name.trim()) { addToast({ title: "Name is required", color: "danger" }); return; }
        setSaving(true);
        try {
            if (drawer.kind === "primary") {
                const body = { primaryDepartmentName: name.trim(), type: pType, goalCriteria, targetCriteria };
                if (drawer.id) await axios.post(`${API}/PrimaryDepartment/update/${drawer.id}`, body, { headers });
                else await axios.post(`${API}/PrimaryDepartment/create`, body, { headers });
                await done(drawer.id ? "Department updated" : "Department created");
            } else if (drawer.id) {
                await axios.post(`${API}/Department/update/${drawer.id}`, {
                    departmentName: name.trim(), departmentDescription: description, executiveLeaderID: el ? Number(el) : undefined, functionalLeaderID: fl ? Number(fl) : undefined,
                    primaryDepartmentId: parent !== NONE ? Number(parent) : undefined,
                }, { headers });
                await done("Sub department updated");
            } else {
                if (!el) { addToast({ title: "Choose an Executive Leader", color: "danger" }); setSaving(false); return; }
                const res = await axios.post(`${API}/Department/create`, {
                    departmentName: name.trim(), departmentDescription: description, executiveLeaderID: Number(el), primaryDepartmentId: parent !== NONE ? Number(parent) : undefined,
                }, { headers });
                const newId = res.data?.response?.departmentID;
                if (fl && newId) await axios.post(`${API}/Department/update/${newId}`, { functionalLeaderID: Number(fl) }, { headers });
                await done("Sub department created");
            }
        } catch (e) {
            fail(drawer.kind === "primary" ? "Could not save the department" : "Could not save the sub department", e);
        }
        setSaving(false);
    };

    const runConfirm = async () => {
        if (!confirm) return;
        try {
            if (confirm.kind === "primary") await axios.post(`${API}/PrimaryDepartment/status`, { primaryDepartmentId: confirm.id, isActive: confirm.to }, { headers });
            else if (confirm.action === "delete") await axios.post(`${API}/Department/archive`, { departmentIDList: [confirm.id] }, { headers });
            else await axios.post(`${API}/Department/status`, { departmentIDList: [confirm.id], departmentStatus: confirm.to }, { headers });
            addToast({ title: confirm.action === "delete" ? "Sub department deleted" : confirm.to ? "Activated" : "Deactivated", color: "success" });
            await load();
        } catch {
            addToast({ title: "Could not complete that", color: "danger" });
        }
        setConfirm(null);
    };

    // ── rendering ────────────────────────────────────────────────────────────────────────────────
    const menu = (items: { key: string; label: string; danger?: boolean; run: () => void }[]) => (
        <Dropdown placement="bottom-end">
            <DropdownTrigger><Button isIconOnly size="sm" variant="light" aria-label="Actions"><MoreVertical size={16} /></Button></DropdownTrigger>
            <DropdownMenu aria-label="Actions" onAction={(k) => items.find((i) => i.key === k)?.run()}>
                {items.map((i) => <DropdownItem key={i.key} className={i.danger ? "text-danger" : undefined} color={i.danger ? "danger" : "default"}>{i.label}</DropdownItem>)}
            </DropdownMenu>
        </Dropdown>
    );

    const subRow = (s: Sub, typeOf?: Primary["type"]) => (
        <tr key={`s${s.id}`} className={cn("border-b border-ink-100 hover:bg-ink-50/60 dark:border-white/5 dark:hover:bg-white/[0.03]", !s.active && "opacity-60")}>
            <td className="px-4 py-2.5"><span className="flex items-center gap-2 pl-7 text-ink-900 dark:text-white"><span className="text-ink-300" aria-hidden>└</span>{s.name}</span></td>
            <td className="px-4 py-2.5 text-xs text-ink-400">{typeOf ? typeChip(typeOf) : "—"}</td>
            <td className="px-4 py-2.5 text-ink-600 dark:text-ink-300">{s.elName || "—"}</td>
            <td className="px-4 py-2.5 text-ink-600 dark:text-ink-300">{s.flName || "—"}</td>
            <td className="max-w-[280px] truncate px-4 py-2.5 text-xs text-ink-500 dark:text-ink-400" title={s.description}>{s.description || "—"}</td>
            <td className="px-4 py-2.5">{statusText(s.active)}</td>
            <td className="px-4 py-2.5 text-right">{menu([
                { key: "edit", label: "Edit", run: () => open({ kind: "sub", id: s.id }) },
                { key: "toggle", label: s.active ? "Deactivate" : "Activate", run: () => setConfirm({ kind: "sub", id: s.id, name: s.name, action: "toggle", to: !s.active }) },
                { key: "delete", label: "Delete", danger: true, run: () => setConfirm({ kind: "sub", id: s.id, name: s.name, action: "delete" }) },
            ])}</td>
        </tr>
    );

    return (
        <div className="flex flex-col gap-5">
            <PageHeader title="Departments" subtitle="Each department with the sub departments under it, where people, tasks, targets and goals live." className="mb-0" />

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <Segmented size="sm" label="View" value={view} onChange={setView} options={[{ key: "table", label: "Table" }, { key: "chart", label: "Hierarchy chart" }]} />
                    {view === "table" && (
                        <>
                            <label className="relative block w-64">
                                <span className="sr-only">Search departments</span>
                                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search departments or leaders"
                                    className="h-8 w-full border border-ink-200 bg-transparent pl-9 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500 dark:border-white/15 dark:text-white" />
                            </label>
                            <Segmented size="sm" label="Type" value={type} onChange={setType} options={[{ key: "all", label: "All" }, { key: "BUSINESS", label: "Business" }, { key: "SUPPORT", label: "Support" }]} />
                            <Segmented size="sm" label="Status" value={status} onChange={setStatus} options={[{ key: "all", label: "All" }, { key: "active", label: "Active" }, { key: "inactive", label: "Inactive" }]} />
                        </>
                    )}
                </div>
                <Dropdown placement="bottom-end">
                    <DropdownTrigger><Button size="sm" color="primary" startContent={<Plus size={14} />} endContent={<ChevronDown size={14} />}>Add</Button></DropdownTrigger>
                    <DropdownMenu aria-label="Add" onAction={(k) => open({ kind: k === "primary" ? "primary" : "sub" })}>
                        <DropdownItem key="primary">Department</DropdownItem>
                        <DropdownItem key="sub">Sub department</DropdownItem>
                    </DropdownMenu>
                </Dropdown>
            </div>

            {view === "chart" ? <PrimaryDepartmentPage view="hierarchy" /> : loading ? (
                <p className="py-16 text-center text-sm text-ink-500">Loading departments…</p>
            ) : (
                <div className="overflow-x-auto border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
                    <table className="w-full text-sm">
                        <thead className="bg-ink-50 dark:bg-white/5">
                            <tr className="border-b border-ink-200 dark:border-white/10">
                                {["Department / sub department", "Type", "Executive leader", "Functional leader", "Details", "Status", ""].map((h, i) => <th key={i} className="px-4 py-2.5 text-left">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {groups.list.map(({ primary: p, total, rows }) => {
                                const shut = closed.has(p.id);
                                return [
                                    <tr key={`p${p.id}`} className={cn("border-b border-ink-200 bg-ink-50/70 dark:border-white/10 dark:bg-white/[0.04]", !p.active && "opacity-60")}>
                                        <td className="px-4 py-3">
                                            <button type="button" onClick={() => toggle(p.id)} aria-expanded={!shut} className="flex items-center gap-2 text-left font-bold text-ink-900 focus-ring dark:text-white">
                                                {shut ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                                                {p.name}
                                                <span className="bg-ink-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-ink-600 dark:bg-white/10 dark:text-ink-300">{total} sub {total === 1 ? "department" : "departments"}</span>
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">{typeChip(p.type)}</td>
                                        <td className="px-4 py-3 text-ink-400">—</td>
                                        <td className="px-4 py-3 text-ink-400">—</td>
                                        <td className="px-4 py-3 text-xs text-ink-500 dark:text-ink-400">Goals {p.goalCriteria.toLowerCase()} · Targets {p.targetCriteria.toLowerCase()}</td>
                                        <td className="px-4 py-3">{statusText(p.active)}</td>
                                        <td className="px-4 py-3 text-right">{menu([
                                            { key: "edit", label: "Edit", run: () => open({ kind: "primary", id: p.id }) },
                                            { key: "addsub", label: "Add sub department", run: () => open({ kind: "sub", primaryId: p.id }) },
                                            { key: "toggle", label: p.active ? "Deactivate" : "Activate", run: () => setConfirm({ kind: "primary", id: p.id, name: p.name, action: "toggle", to: !p.active }) },
                                        ])}</td>
                                    </tr>,
                                    ...(shut ? [] : rows.map((s) => subRow(s, p.type))),
                                    ...(!shut && rows.length === 0 ? [<tr key={`e${p.id}`} className="border-b border-ink-100 dark:border-white/5"><td colSpan={7} className="px-4 py-2.5 pl-12 text-xs text-ink-400">No sub departments{q || status !== "all" ? " match" : " yet"}.</td></tr>] : []),
                                ];
                            })}
                            {groups.loose.length > 0 && [
                                <tr key="loose" className="border-b border-ink-200 bg-amber-50/60 dark:border-white/10 dark:bg-amber-500/5">
                                    <td className="px-4 py-3 font-bold text-ink-900 dark:text-white" colSpan={7}>Not under a department yet <span className="ml-2 text-xs font-normal text-ink-500">{groups.loose.length} sub {groups.loose.length === 1 ? "department" : "departments"}. Edit one to choose its department.</span></td>
                                </tr>,
                                ...groups.loose.map((s) => subRow(s)),
                            ]}
                            {!groups.list.length && !groups.loose.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-500">Nothing matches.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add / edit */}
            <Drawer isOpen={!!drawer} onOpenChange={(o) => !o && setDrawer(null)}>
                <DrawerContent>
                    {(onClose) => (
                        <>
                            <DrawerHeader>{drawer?.kind === "primary" ? (drawer.id ? "Edit department" : "Add department") : (drawer?.id ? "Edit sub department" : "Add sub department")}</DrawerHeader>
                            <DrawerBody>
                                <div className="space-y-4">
                                    <Input label={drawer?.kind === "primary" ? "Department name" : "Sub department name"} value={name} onChange={(e) => setName(e.target.value)} variant="bordered" isRequired />
                                    {drawer?.kind === "primary" ? (
                                        <>
                                            <Select label="Type" selectedKeys={[pType]} disallowEmptySelection variant="bordered" onSelectionChange={(k) => setPType(Array.from(k)[0] as Primary["type"])}>
                                                <SelectItem key="BUSINESS">Business</SelectItem>
                                                <SelectItem key="SUPPORT">Support</SelectItem>
                                            </Select>
                                            <Select label="Goal criteria" selectedKeys={[goalCriteria]} disallowEmptySelection variant="bordered" onSelectionChange={(k) => setGoalCriteria(Array.from(k)[0] as string)}>
                                                {CRITERIA.map(([k, l]) => <SelectItem key={k}>{l}</SelectItem>)}
                                            </Select>
                                            <Select label="Target criteria" selectedKeys={[targetCriteria]} disallowEmptySelection variant="bordered" onSelectionChange={(k) => setTargetCriteria(Array.from(k)[0] as string)}>
                                                {CRITERIA.map(([k, l]) => <SelectItem key={k}>{l}</SelectItem>)}
                                            </Select>
                                        </>
                                    ) : (
                                        <>
                                            <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} variant="bordered" />
                                            <Select label="Department" placeholder="Choose the department it sits under" selectedKeys={[parent]} disallowEmptySelection variant="bordered" onSelectionChange={(k) => setParent(Array.from(k)[0] as string)}>
                                                {[<SelectItem key={NONE}>No department yet</SelectItem>, ...primaries.filter((p) => p.active || String(p.id) === parent).map((p) => <SelectItem key={String(p.id)}>{p.name}</SelectItem>)]}
                                            </Select>
                                            <Autocomplete label="Executive leader" placeholder="Search a person" selectedKey={el || null} variant="bordered" isRequired onSelectionChange={(k) => setEl(k ? String(k) : "")}>
                                                {people.map((u) => <AutocompleteItem key={u.id}>{u.name}</AutocompleteItem>)}
                                            </Autocomplete>
                                            <Autocomplete label="Functional leader" placeholder="Search a person" selectedKey={fl || null} variant="bordered" onSelectionChange={(k) => setFl(k ? String(k) : "")}>
                                                {people.map((u) => <AutocompleteItem key={u.id}>{u.name}</AutocompleteItem>)}
                                            </Autocomplete>
                                        </>
                                    )}
                                </div>
                            </DrawerBody>
                            <DrawerFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={saving} onPress={save}>{drawer?.id ? "Save changes" : "Add"}</Button>
                            </DrawerFooter>
                        </>
                    )}
                </DrawerContent>
            </Drawer>

            {/* Activate / deactivate / delete */}
            <Modal isOpen={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} size="sm">
                <ModalContent>
                    {() => (
                        <>
                            <ModalHeader>{confirm?.action === "delete" ? "Delete sub department" : confirm?.to ? "Activate" : "Deactivate"}</ModalHeader>
                            <ModalBody>
                                <p className="text-sm">
                                    {confirm?.action === "delete" ? "Delete" : confirm?.to ? "Activate" : "Deactivate"} <b>{confirm?.name}</b>?
                                    {confirm?.kind === "primary" && !confirm?.to ? " Its sub departments stay as they are." : ""}
                                </p>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={() => setConfirm(null)}>Cancel</Button>
                                <Button color={confirm?.action === "delete" || !confirm?.to ? "danger" : "success"} onPress={runConfirm}>Confirm</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}
