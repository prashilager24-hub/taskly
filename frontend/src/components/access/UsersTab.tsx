import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { KeyRound, Pencil, Plus, Power, Search } from "lucide-react";

import { Segmented } from "@/components/page";
import {
    Button, Chip, Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, Input, Select, SelectItem, addToast,
} from "@/components/ui";
import { UserAccessMatrix } from "./PermissionMatrix";
import { accessApi, errorText, type ModuleDef, type Privileges, type RoleRow, type UserExplain, type UserRow, type DepartmentRow } from "./api";

const API = "/t2.0/authentificationUtilization";

// ── Access canvas: where a person's access comes from, their own exceptions, and two-factor ──────

function AccessCanvas({ user, catalog, onClose, onChanged }: { user: UserRow | null; catalog: ModuleDef[]; onClose: () => void; onChanged: () => void }) {
    const [explain, setExplain] = useState<UserExplain | null>(null);
    const [grants, setGrants] = useState<Privileges>({});
    const [denies, setDenies] = useState<Privileges>({});
    const [twoFactor, setTwoFactor] = useState<UserRow["twoFactor"]>("default");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!user) return;
        setExplain(null);
        setTwoFactor(user.twoFactor);
        accessApi.explain(user.userId).then((e) => { setExplain(e); setGrants(e.grants); setDenies(e.denies); }).catch((e) => addToast({ title: "Could not load access", description: errorText(e), color: "danger" }));
    }, [user]);

    const dirty = useMemo(() => !!explain && (JSON.stringify(grants) !== JSON.stringify(explain.grants) || JSON.stringify(denies) !== JSON.stringify(explain.denies)), [explain, grants, denies]);

    const save = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const next = await accessApi.saveUserAccess(user.userId, grants, denies);
            setExplain(next); setGrants(next.grants); setDenies(next.denies);
            addToast({ title: "Access saved", description: `${user.name}'s access was updated.`, color: "success" });
            onChanged();
        } catch (e) { addToast({ title: "Could not save", description: errorText(e), color: "danger" }); } finally { setSaving(false); }
    };

    const changeTwoFactor = async (value: UserRow["twoFactor"]) => {
        if (!user) return;
        setTwoFactor(value);
        try {
            await accessApi.setTwoFactor([user.userId], value);
            addToast({ title: "Sign-in security updated", description: value === "default" ? "Follows the organisation setting." : `Two-factor is ${value} for ${user.name}.`, color: "success" });
            onChanged();
        } catch (e) { setTwoFactor(user.twoFactor); addToast({ title: "Could not update", description: errorText(e), color: "danger" }); }
    };

    const openCount = explain ? Object.keys(explain.effective).length : 0;

    return (
        <Drawer isOpen={!!user} onOpenChange={(o) => { if (!o) onClose(); }} size="3xl">
            <DrawerContent>
                <DrawerHeader className="flex flex-col gap-1">
                    <span className="eyebrow">Access</span>
                    <span>{user?.name}</span>
                    <span className="text-xs font-normal normal-case tracking-normal text-ink-500">{user?.email}</span>
                </DrawerHeader>
                <DrawerBody className="gap-6">
                    {!explain ? <p className="text-sm text-ink-500">Loading…</p> : (
                        <>
                            <dl className="grid grid-cols-1 gap-px border border-ink-200 bg-ink-200 dark:border-white/10 dark:bg-white/10 sm:grid-cols-3">
                                {[["Role", explain.roleNames.join(" + ") || "None"], ["Departments", explain.departments.map((d) => d.name).join(", ") || "None"], ["Can open", `${openCount} modules`]].map(([k, v]) => (
                                    <div key={k} className="bg-white px-4 py-3 dark:bg-ink-900"><dt className="eyebrow">{k}</dt><dd className="mt-1 text-sm font-semibold text-ink-900 dark:text-white">{v}</dd></div>
                                ))}
                            </dl>

                            <section className="flex flex-col gap-2">
                                <h3 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">Sign-in security</h3>
                                <p className="text-xs text-ink-500 dark:text-ink-400">Whether {user?.name.split(" ")[0]} must enter an emailed code after the password.</p>
                                <Segmented label="Two-factor" value={twoFactor} onChange={changeTwoFactor}
                                    options={[{ key: "default", label: "Follow default" }, { key: "on", label: "Always on" }, { key: "off", label: "Off" }]} />
                            </section>

                            <section className="flex flex-col gap-2">
                                <h3 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">Module access</h3>
                                {explain.isSuperAdmin ? (
                                    <p className="border border-ink-200 bg-ink-50 p-3 text-sm text-ink-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-300">Super Admin always has full access, so it cannot be changed here.</p>
                                ) : (
                                    <>
                                        <p className="text-xs text-ink-500 dark:text-ink-400">Grey ticks come from the role and departments. Click one to take it away from this person, or click an empty box to add it just for them.</p>
                                        <UserAccessMatrix catalog={catalog} explain={explain.modules} grants={grants} denies={denies} onChange={(g, d) => { setGrants(g); setDenies(d); }} />
                                    </>
                                )}
                            </section>
                        </>
                    )}
                </DrawerBody>
                <DrawerFooter>
                    <Button variant="bordered" onPress={onClose}>Close</Button>
                    {!explain?.isSuperAdmin && <Button color="primary" isDisabled={!dirty} isLoading={saving} onPress={save}>Save access</Button>}
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}

// ── Add / edit user ──────────────────────────────────────────────────────────────────────────────

interface FullUser { userID: number; userName: string; userEmail: string; employeeID: string | null; roleID: number; secondaryRoleID: number | null; departments: { departmentID: number }[]; reportingManagerId: number | null; elManagerId: number | null; appraisalCycle: string | null; feedbackresolverteam: string | null }
const BLANK = { employeeID: "", name: "", email: "", password: "", roleID: "", secondaryRoleID: "", departmentID: "", reportingManagerId: "", elManagerId: "", appraisalCycle: "QUARTERLY" };

function UserCanvas({ open, editing, roles, departments, people, onClose, onSaved }: { open: boolean; editing: FullUser | null; roles: RoleRow[]; departments: DepartmentRow[]; people: UserRow[]; onClose: () => void; onSaved: () => void }) {
    const [f, setF] = useState(BLANK);
    const [saving, setSaving] = useState(false);
    const set = (k: keyof typeof BLANK) => (v: string) => setF((p) => ({ ...p, [k]: v }));

    useEffect(() => {
        if (!open) return;
        setF(editing ? {
            employeeID: editing.employeeID ?? "", name: editing.userName, email: editing.userEmail, password: "", roleID: String(editing.roleID),
            secondaryRoleID: editing.secondaryRoleID ? String(editing.secondaryRoleID) : "", departmentID: editing.departments?.[0] ? String(editing.departments[0].departmentID) : "",
            reportingManagerId: editing.reportingManagerId ? String(editing.reportingManagerId) : "", elManagerId: editing.elManagerId ? String(editing.elManagerId) : "", appraisalCycle: editing.appraisalCycle || "QUARTERLY",
        } : BLANK);
    }, [open, editing]);

    const valid = f.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(f.email) && !!f.roleID && (editing || f.password.length >= 6);

    const save = async () => {
        setSaving(true);
        const payload: Record<string, unknown> = {
            employeeID: f.employeeID || null, userName: f.name.trim(), userEmail: f.email.trim(), roleID: Number(f.roleID),
            secondaryRoleID: f.secondaryRoleID ? Number(f.secondaryRoleID) : null, departmentID: f.departmentID ? Number(f.departmentID) : null,
            reportingManagerId: f.reportingManagerId ? Number(f.reportingManagerId) : null, elManagerId: f.elManagerId ? Number(f.elManagerId) : null, appraisalCycle: f.appraisalCycle,
        };
        try {
            if (editing) await axios.put(`${API}/User/update`, { ...payload, userID: editing.userID });
            else await axios.post(`${API}/User/create`, { ...payload, password: f.password });
            addToast({ title: editing ? "User updated" : "User created", description: f.name, color: "success" });
            onSaved(); onClose();
        } catch (e) { addToast({ title: "Could not save user", description: errorText(e), color: "danger" }); } finally { setSaving(false); }
    };

    const pick = (label: string, value: string, onChange: (v: string) => void, items: { key: string; label: string }[], optional = false) => (
        <Select label={label} labelPlacement="outside" placeholder={optional ? "None" : "Select"} selectedKeys={value ? new Set([value]) : new Set()} onSelectionChange={(k) => onChange(Array.from(k)[0] ? String(Array.from(k)[0]) : "")}>
            {items.map((i) => <SelectItem key={i.key}>{i.label}</SelectItem>)}
        </Select>
    );

    return (
        <Drawer isOpen={open} onOpenChange={(o) => { if (!o) onClose(); }} size="xl">
            <DrawerContent>
                <DrawerHeader className="flex flex-col gap-1"><span className="eyebrow">Users</span><span>{editing ? "Edit user" : "Add user"}</span></DrawerHeader>
                <DrawerBody className="gap-5">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <Input label="Full name" labelPlacement="outside" placeholder="Name" value={f.name} onValueChange={set("name")} isRequired />
                        <Input label="Employee ID" labelPlacement="outside" placeholder="EMP001" value={f.employeeID} onValueChange={set("employeeID")} />
                        <Input label="Email" labelPlacement="outside" type="email" placeholder="name@company.com" value={f.email} onValueChange={set("email")} isRequired className="sm:col-span-2" />
                        {!editing && <Input label="Temporary password" labelPlacement="outside" type="password" placeholder="At least 6 characters" value={f.password} onValueChange={set("password")} isRequired className="sm:col-span-2" />}
                    </div>
                    <p className="eyebrow">Role and department</p>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {pick("Role", f.roleID, set("roleID"), roles.filter((r) => r.active).map((r) => ({ key: String(r.roleId), label: r.roleName })))}
                        {pick("Second role (optional)", f.secondaryRoleID, set("secondaryRoleID"), roles.filter((r) => r.active).map((r) => ({ key: String(r.roleId), label: r.roleName })), true)}
                        {pick("Department", f.departmentID, set("departmentID"), departments.map((d) => ({ key: String(d.departmentId), label: d.name })), true)}
                    </div>
                    <p className="eyebrow">Reporting</p>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {pick("Reporting manager", f.reportingManagerId, set("reportingManagerId"), people.filter((p) => p.userId !== editing?.userID).map((p) => ({ key: String(p.userId), label: p.name })), true)}
                        {pick("Executive Leader", f.elManagerId, set("elManagerId"), people.filter((p) => p.userId !== editing?.userID).map((p) => ({ key: String(p.userId), label: p.name })), true)}
                        {pick("Appraisal cycle", f.appraisalCycle, set("appraisalCycle"), [{ key: "QUARTERLY", label: "Quarterly" }, { key: "HALF_YEARLY", label: "Half yearly" }, { key: "ANNUAL", label: "Annual" }])}
                    </div>
                </DrawerBody>
                <DrawerFooter>
                    <Button variant="bordered" onPress={onClose}>Cancel</Button>
                    <Button color="primary" isDisabled={!valid} isLoading={saving} onPress={save}>{editing ? "Save changes" : "Create user"}</Button>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}

// ── The tab ──────────────────────────────────────────────────────────────────────────────────────

export default function UsersTab({ catalog, roles, departments, onChanged }: { catalog: ModuleDef[]; roles: RoleRow[]; departments: DepartmentRow[]; onChanged: () => void }) {
    const [users, setUsers] = useState<UserRow[]>([]);
    const [full, setFull] = useState<FullUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [role, setRole] = useState("all");
    const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
    const [accessFor, setAccessFor] = useState<UserRow | null>(null);
    const [form, setForm] = useState<{ open: boolean; editing: FullUser | null }>({ open: false, editing: null });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setUsers(await accessApi.users());
            const r = await axios.post(`${API}/users/read?page=0&size=0`, { filter: "", searchText: "", departmentID: null });
            setFull(r.data?.response?.users ?? []);
        } catch (e) { addToast({ title: "Could not load users", description: errorText(e), color: "danger" }); } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const shown = users.filter((u) =>
        (status === "all" || (status === "active") === u.active) &&
        (role === "all" || String(u.roleId) === role || String(u.secondaryRoleId) === role) &&
        (!q || `${u.name} ${u.email} ${u.employeeId ?? ""}`.toLowerCase().includes(q.toLowerCase())));

    const toggleStatus = async (u: UserRow) => {
        try {
            await axios.post(`${API}/updateUserStatus`, { userStatus: u.active ? 0 : 1, userIdList: [u.userId] });
            addToast({ title: u.active ? "User deactivated" : "User activated", description: u.name, color: "success" });
            load();
        } catch (e) { addToast({ title: "Could not change status", description: errorText(e), color: "danger" }); }
    };

    const refresh = () => { load(); onChanged(); };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-wrap items-end gap-3">
                    <Input aria-label="Search users" className="w-64" placeholder="Search name, email, employee ID" startContent={<Search size={14} className="text-ink-400" />} value={q} onValueChange={setQ} isClearable />
                    <Select aria-label="Role" className="w-48" selectedKeys={new Set([role])} onSelectionChange={(k) => setRole(String(Array.from(k)[0] ?? "all"))}>
                        {[<SelectItem key="all">All roles</SelectItem>, ...roles.map((r) => <SelectItem key={String(r.roleId)}>{r.roleName}</SelectItem>)]}
                    </Select>
                    <Segmented label="Status" size="sm" value={status} onChange={setStatus} options={[{ key: "active", label: "Active" }, { key: "inactive", label: "Inactive" }, { key: "all", label: "All" }]} />
                </div>
                <Button color="primary" startContent={<Plus size={14} />} onPress={() => setForm({ open: true, editing: null })}>Add user</Button>
            </div>

            <div className="overflow-x-auto border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
                <table className="w-full text-sm">
                    <thead><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-white/5">
                        {["User", "Role", "Departments", "Access", "Two-factor", "Status", ""].map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}
                    </tr></thead>
                    <tbody>
                        {shown.map((u) => (
                            <tr key={u.userId} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/60 dark:border-white/5 dark:hover:bg-white/5">
                                <td className="px-4 py-3"><p className="font-semibold text-ink-900 dark:text-white">{u.name}</p><p className="text-xs text-ink-500 dark:text-ink-400">{u.email}</p></td>
                                <td className="px-4 py-3">{u.roleName}{u.secondaryRoleName && <span className="text-ink-500"> + {u.secondaryRoleName}</span>}</td>
                                <td className="px-4 py-3 text-ink-700 dark:text-ink-200">{u.departments.join(", ") || "—"}</td>
                                <td className="px-4 py-3">{u.hasOverrides ? <Chip size="sm" color="warning" variant="flat">Custom</Chip> : <span className="text-xs text-ink-500">As role</span>}</td>
                                <td className="px-4 py-3">
                                    <Chip size="sm" color={u.twoFactorEffective ? "success" : "default"} variant="flat">{u.twoFactorEffective ? "On" : "Off"}</Chip>
                                    {u.twoFactor !== "default" && <span className="ml-1.5 text-[11px] text-ink-500">set for this user</span>}
                                </td>
                                <td className="px-4 py-3"><Chip size="sm" color={u.active ? "success" : "danger"} variant="dot">{u.active ? "Active" : "Inactive"}</Chip></td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-1.5">
                                        <Button size="sm" variant="bordered" startContent={<KeyRound size={13} />} onPress={() => setAccessFor(u)}>Access</Button>
                                        <Button size="sm" variant="bordered" isIconOnly aria-label={`Edit ${u.name}`} onPress={() => setForm({ open: true, editing: full.find((f) => f.userID === u.userId) ?? null })}><Pencil size={13} /></Button>
                                        <Button size="sm" variant="bordered" isIconOnly aria-label={u.active ? `Deactivate ${u.name}` : `Activate ${u.name}`} isDisabled={u.roleId === 1 && u.active && users.filter((x) => x.roleId === 1 && x.active).length <= 1} onPress={() => toggleStatus(u)}><Power size={13} /></Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!shown.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-ink-500">{loading ? "Loading users…" : "No users match."}</td></tr>}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-ink-500 dark:text-ink-400">{shown.length} of {users.length} users</p>

            <AccessCanvas user={accessFor} catalog={catalog} onClose={() => setAccessFor(null)} onChanged={refresh} />
            <UserCanvas open={form.open} editing={form.editing} roles={roles} departments={departments} people={users} onClose={() => setForm({ open: false, editing: null })} onSaved={refresh} />
        </div>
    );
}
