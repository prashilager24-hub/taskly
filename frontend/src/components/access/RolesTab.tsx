import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button, Chip, Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, Input, Select, SelectItem, Switch, Textarea, addToast } from "@/components/ui";
import PermissionMatrix from "./PermissionMatrix";
import { accessApi, countModules, errorText, type DepartmentRow, type ModuleDef, type Privileges, type RoleRow } from "./api";
import { USER_TYPES, userTypeLabel, type UserType } from "./userTypes";

// ── Roles: a named set of module access that any number of people can hold ───────────────────────

export function RolesTab({ catalog, roles, onChanged }: { catalog: ModuleDef[]; roles: RoleRow[]; onChanged: () => void }) {
    const [edit, setEdit] = useState<{ open: boolean; role: RoleRow | null }>({ open: false, role: null });
    const [name, setName] = useState("");
    const [userType, setUserType] = useState<UserType | "">("");
    const [description, setDescription] = useState("");
    const [active, setActive] = useState(true);
    const [privileges, setPrivileges] = useState<Privileges>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!edit.open) return;
        const r = edit.role;
        setName(r?.roleName ?? ""); setUserType(r?.userType ?? ""); setDescription(r?.description ?? ""); setActive(r?.active ?? true); setPrivileges(r?.privileges ?? { dashboard: ["read"], hrfeedback: ["read", "create"] });
    }, [edit]);

    const save = async () => {
        setSaving(true);
        try {
            await accessApi.saveRole({ roleId: edit.role?.roleId, roleName: name, userType: userType || null, description, active, privileges });
            addToast({ title: edit.role ? "Role updated" : "Role created", description: name, color: "success" });
            setEdit({ open: false, role: null }); onChanged();
        } catch (e) { addToast({ title: "Could not save role", description: errorText(e), color: "danger" }); } finally { setSaving(false); }
    };

    const remove = async (r: RoleRow) => {
        if (!window.confirm(`Remove the role "${r.roleName}"?`)) return;
        try { await accessApi.deleteRole(r.roleId); addToast({ title: "Role removed", description: r.roleName, color: "success" }); onChanged(); }
        catch (e) { addToast({ title: "Could not remove role", description: errorText(e), color: "danger" }); }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-sm text-ink-500 dark:text-ink-400">A role decides which modules people can open and what they can do there. Each role belongs to a user type (Super Admin, Admin, EL, FL, Manager, Lead, Associate, Intern); people are shown by their user type. Add exceptions for one person from their Access panel.</p>
                <Button color="primary" startContent={<Plus size={14} />} onPress={() => setEdit({ open: true, role: null })}>New role</Button>
            </div>
            <div className="overflow-x-auto border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
                <table className="w-full text-sm">
                    <thead><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-white/5">{["Role", "User type", "Modules", "People", "Status", ""].map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
                    <tbody>
                        {roles.map((r) => (
                            <tr key={r.roleId} className="border-b border-ink-100 last:border-0 dark:border-white/5">
                                <td className="px-4 py-3"><p className="font-semibold text-ink-900 dark:text-white">{r.roleName}{r.system && <span className="ml-2 text-[10.5px] font-bold uppercase tracking-wide text-brand-600">System</span>}</p>{r.description && <p className="text-xs text-ink-500 dark:text-ink-400">{r.description}</p>}</td>
                                <td className="px-4 py-3">{r.userType ? userTypeLabel(r.userType) : <span className="text-xs text-ink-400">Not set</span>}</td>
                                <td className="px-4 py-3">{r.system ? "All" : `${countModules(r.privileges)} of ${catalog.reduce((n, m) => n + 1 + (m.children?.length ?? 0), 0)}`}</td>
                                <td className="px-4 py-3">{r.userCount}</td>
                                <td className="px-4 py-3"><Chip size="sm" variant="dot" color={r.active ? "success" : "default"}>{r.active ? "Active" : "Inactive"}</Chip></td>
                                <td className="px-4 py-3"><div className="flex justify-end gap-1.5">
                                    <Button size="sm" variant="bordered" startContent={<Pencil size={13} />} onPress={() => setEdit({ open: true, role: r })}>{r.system ? "View" : "Edit"}</Button>
                                    {!r.system && <Button size="sm" variant="bordered" isIconOnly aria-label={`Remove ${r.roleName}`} onPress={() => remove(r)}><Trash2 size={13} /></Button>}
                                </div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Drawer isOpen={edit.open} onOpenChange={(o) => { if (!o) setEdit({ open: false, role: null }); }} size="3xl">
                <DrawerContent>
                    <DrawerHeader className="flex flex-col gap-1"><span className="eyebrow">Roles</span><span>{edit.role ? (edit.role.system ? edit.role.roleName : `Edit ${edit.role.roleName}`) : "New role"}</span></DrawerHeader>
                    <DrawerBody className="gap-5">
                        {edit.role?.system && <p className="border border-ink-200 bg-ink-50 p-3 text-sm text-ink-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-300">This role always has full access and cannot be changed.</p>}
                        <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2">
                            <div className="flex flex-col gap-2"><span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-700 dark:text-ink-300">Role name <span className="text-brand-600">*</span></span>
                                <Input aria-label="Role name" placeholder="e.g. Team Lead" value={name} onValueChange={setName} isDisabled={edit.role?.system} isRequired />
                            </div>
                            <div className="flex flex-col gap-2"><span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-700 dark:text-ink-300">User type</span>
                            <Select aria-label="User type" placeholder="Choose the user type" selectedKeys={userType ? new Set([userType]) : new Set()} onSelectionChange={(k) => setUserType((Array.from(k)[0] as UserType | undefined) ?? "")} isDisabled={edit.role?.system} description="People with this role are shown as this type.">
                                {USER_TYPES.map((t) => <SelectItem key={t.key}>{t.label}</SelectItem>)}
                            </Select>
                            </div>
                            <div className="flex items-end pb-1"><Switch isSelected={active} onValueChange={setActive} isDisabled={edit.role?.system}>Active</Switch></div>
                            <Textarea label="Description" labelPlacement="outside" placeholder="Who is this role for?" value={description} onValueChange={setDescription} isDisabled={edit.role?.system} className="sm:col-span-2" minRows={2} />
                        </div>
                        <PermissionMatrix catalog={catalog} value={privileges} onChange={setPrivileges} readOnly={edit.role?.system} />
                    </DrawerBody>
                    <DrawerFooter>
                        <Button variant="bordered" onPress={() => setEdit({ open: false, role: null })}>{edit.role?.system ? "Close" : "Cancel"}</Button>
                        {!edit.role?.system && <Button color="primary" isDisabled={name.trim().length < 2} isLoading={saving} onPress={save}>{edit.role ? "Save role" : "Create role"}</Button>}
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </div>
    );
}

// ── Departments: extra access for everyone who works in or leads a department ─────────────────────

export function DepartmentsTab({ catalog, departments, onChanged }: { catalog: ModuleDef[]; departments: DepartmentRow[]; onChanged: () => void }) {
    const [dept, setDept] = useState<DepartmentRow | null>(null);
    const [privileges, setPrivileges] = useState<Privileges>({});
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (dept) setPrivileges(dept.privileges); }, [dept]);

    const save = async () => {
        if (!dept) return;
        setSaving(true);
        try { await accessApi.saveDepartment(dept.departmentId, privileges); addToast({ title: "Department access saved", description: dept.name, color: "success" }); setDept(null); onChanged(); }
        catch (e) { addToast({ title: "Could not save", description: errorText(e), color: "danger" }); } finally { setSaving(false); }
    };

    return (
        <div className="flex flex-col gap-4">
            <p className="max-w-2xl text-sm text-ink-500 dark:text-ink-400">Department access is added on top of each person's role, for everyone who belongs to or leads that department. Use it when a whole team needs a module their role does not include.</p>
            <div className="overflow-x-auto border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
                <table className="w-full text-sm">
                    <thead><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-white/5">{["Department", "People", "Extra access", ""].map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
                    <tbody>
                        {departments.map((d) => (
                            <tr key={d.departmentId} className="border-b border-ink-100 last:border-0 dark:border-white/5">
                                <td className="px-4 py-3 font-semibold text-ink-900 dark:text-white">{d.name}</td>
                                <td className="px-4 py-3">{d.memberCount}</td>
                                <td className="px-4 py-3">{countModules(d.privileges) ? <Chip size="sm" color="warning" variant="flat">{countModules(d.privileges)} modules</Chip> : <span className="text-xs text-ink-500">None — role only</span>}</td>
                                <td className="px-4 py-3"><div className="flex justify-end"><Button size="sm" variant="bordered" startContent={<Pencil size={13} />} onPress={() => setDept(d)}>Edit access</Button></div></td>
                            </tr>
                        ))}
                        {!departments.length && <tr><td colSpan={4} className="px-4 py-12 text-center text-ink-500">No departments yet.</td></tr>}
                    </tbody>
                </table>
            </div>
            <Drawer isOpen={!!dept} onOpenChange={(o) => { if (!o) setDept(null); }} size="3xl">
                <DrawerContent>
                    <DrawerHeader className="flex flex-col gap-1"><span className="eyebrow">Department access</span><span>{dept?.name}</span></DrawerHeader>
                    <DrawerBody className="gap-4">
                        <p className="text-xs text-ink-500 dark:text-ink-400">{dept?.memberCount} people. Everything ticked here is given to all of them in addition to their role.</p>
                        <PermissionMatrix catalog={catalog} value={privileges} onChange={setPrivileges} />
                    </DrawerBody>
                    <DrawerFooter>
                        <Button variant="bordered" onPress={() => setDept(null)}>Cancel</Button>
                        <Button color="primary" isLoading={saving} onPress={save}>Save department access</Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </div>
    );
}
