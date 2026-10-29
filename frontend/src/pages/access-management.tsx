import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { PageHeader, Segmented } from "@/components/page";
import { addToast } from "@/components/ui";
import { accessApi, errorText, type DepartmentRow, type ModuleDef, type RoleRow } from "@/components/access/api";
import { DepartmentsTab, RolesTab } from "@/components/access/RolesTab";
import SecurityTab from "@/components/access/SecurityTab";
import HierarchyTab from "@/components/access/HierarchyTab";
import UsersTab from "@/components/access/UsersTab";

type Tab = "users" | "roles" | "departments" | "hierarchy" | "security";
const TABS: { key: Tab; label: string }[] = [
    { key: "users", label: "Users" },
    { key: "roles", label: "Roles" },
    { key: "departments", label: "Departments" },
    { key: "hierarchy", label: "Hierarchy" },
    { key: "security", label: "Security" },
];

// Access Management: who can open what. A person's access is their role, plus the access of their
// departments, plus anything added or taken away for them personally. The menu and every page follow it.
export default function AccessManagementPage() {
    const [params, setParams] = useSearchParams();
    const requested = params.get("tab");
    const tab: Tab = TABS.some((t) => t.key === requested) ? (requested as Tab) : "users";

    const [catalog, setCatalog] = useState<ModuleDef[]>([]);
    const [roles, setRoles] = useState<RoleRow[]>([]);
    const [departments, setDepartments] = useState<DepartmentRow[]>([]);

    const load = useCallback(async () => {
        try {
            const [c, r, d] = await Promise.all([accessApi.catalog(), accessApi.roles(), accessApi.departments()]);
            setCatalog(c); setRoles(r); setDepartments(d);
        } catch (e) { addToast({ title: "Could not load access settings", description: errorText(e), color: "danger" }); }
    }, []);
    useEffect(() => { load(); }, [load]);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Access management" subtitle="Decide who can open which modules: by role, by department, or for one person. Two-factor sign-in is managed here too.">
                <Segmented label="Access sections" value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} options={TABS} />
            </PageHeader>

            {tab === "users" && <UsersTab catalog={catalog} roles={roles} departments={departments} onChanged={load} />}
            {tab === "roles" && <RolesTab catalog={catalog} roles={roles} onChanged={load} />}
            {tab === "departments" && <DepartmentsTab catalog={catalog} departments={departments} onChanged={load} />}
            {tab === "hierarchy" && <HierarchyTab />}
            {tab === "security" && <SecurityTab onChanged={load} />}
        </div>
    );
}
