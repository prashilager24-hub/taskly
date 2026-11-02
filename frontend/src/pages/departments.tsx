import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";

import { PageHeader, Segmented } from "@/components/page";
import { Button } from "@/components/ui";
import { hasModuleAccess } from "@/lib/permissions";
import { deptApi, errorText, type Candidate, type Department, type SubDepartment } from "@/components/deptmgmt/api";
import ListView from "@/components/deptmgmt/ListView";
import HierarchyView from "@/components/deptmgmt/HierarchyView";
import { DepartmentDrawer, MapDrawer } from "@/components/deptmgmt/forms";
import { DepartmentPage, SubDepartmentPage } from "@/components/deptmgmt/DepartmentPages";

// Department Management: /departments (Departments | Hierarchy), /departments/:id (a department), /departments/sub/:subId (a sub department)

type Tab = "departments" | "hierarchy";

function Overview() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const tab: Tab = params.get("tab") === "hierarchy" ? "hierarchy" : "departments";
    const [data, setData] = useState<{ departments: Department[]; subDepartments: SubDepartment[] } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [creating, setCreating] = useState(false);
    const [mapping, setMapping] = useState(false);
    const canCreate = hasModuleAccess("deptmgmt", "create");
    const canWrite = hasModuleAccess("deptmgmt", "update");

    const load = useCallback(async () => { try { setData(await deptApi.overview()); setError(null); } catch (e) { setError(errorText(e)); } }, []);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { if (canCreate) deptApi.candidates().then(setCandidates).catch(() => setCandidates([])); }, [canCreate]);

    return (
        <div className="flex flex-col gap-5">
            <PageHeader title="Department Management" subtitle="Every department, its sub departments and the people, tasks, targets and goals in them." className="mb-0">
                {canCreate && <Button color="primary" startContent={<Plus size={14} />} onPress={() => setCreating(true)}>New department</Button>}
            </PageHeader>
            <div><Segmented label="Department Management sections" value={tab} onChange={(t) => setParams(t === "departments" ? {} : { tab: t }, { replace: true })} options={[{ key: "departments", label: "Departments" }, { key: "hierarchy", label: "Hierarchy" }]} /></div>

            {!data ? <p className="py-24 text-center text-sm text-ink-500">{error ?? "Loading departments…"}</p>
                : tab === "departments" ? <ListView departments={data.departments} subs={data.subDepartments} canWrite={canWrite} onMap={() => setMapping(true)} />
                    : <HierarchyView departments={data.departments} subs={data.subDepartments} />}

            {data && (
                <>
                    <DepartmentDrawer open={creating} editing={null} departments={data.departments} subCodes={data.subDepartments.map((s) => s.code)} candidates={candidates}
                        onClose={() => setCreating(false)} onSaved={(id) => navigate(`/departments/${id}`)} />
                    <MapDrawer open={mapping} loose={data.subDepartments.filter((s) => !s.departmentId)} departments={data.departments} onClose={() => setMapping(false)} onSaved={load} />
                </>
            )}
        </div>
    );
}

export default function DepartmentsPage() {
    const { id, subId } = useParams();
    if (subId) return <SubDepartmentPage key={subId} id={Number(subId)} />;
    if (id) return <DepartmentPage key={id} id={Number(id)} />;
    return <Overview />;
}
