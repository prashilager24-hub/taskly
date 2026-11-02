import axios from "axios";

// Department Management: departments (TM-D##) hold sub departments (TM-SD##); people, tasks, targets and goals belong to sub departments.

const BASE = "/t2.0/authentificationUtilization";
const unwrap = async <T,>(p: Promise<{ data: { response: T } }>) => (await p).data.response;

export type DeptType = "BUSINESS" | "SUPPORT";
export type Criteria = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "COMBINED";
export interface Ref { userId: number; name: string }

export interface Department {
    id: number; code: string | null; name: string; type: DeptType | null; goalCriteria: Criteria | null; targetCriteria: Criteria | null;
    description: string; active: boolean; createdAt: string | null; singleTeam: boolean;
    subDepartments: number; people: number; activePeople: number; tasks: number; targets: number; goals: number;
}
export interface SubDepartment {
    id: number; code: string | null; name: string; description: string; active: boolean; isTeam: boolean; departmentId: number | null;
    el: Ref | null; fl: Ref | null; people: number; activePeople: number; tasks: number; targets: number; goals: number; createdAt: string | null;
}
export interface Person {
    userId: number; name: string; email: string; employeeId: string | null; designation: string | null; roleName: string | null;
    userType: string | null; userRole: string | null; subDepartmentId: number; reportsTo: Ref | null; active: boolean;
    joined: string | null; appraisalCycle: string | null;
}
export interface Candidate { userId: number; name: string; email: string; active: boolean; subDepartmentIds: number[] }

export interface SubInput { name: string; elId?: number | null; flId?: number | null; description?: string | null }
export interface DepartmentInput {
    name: string; type: DeptType; goalCriteria: Criteria; targetCriteria: Criteria; description?: string | null;
    subDepartments?: SubInput[] | null; elId?: number | null; flId?: number | null;
}

export const deptApi = {
    overview: () => unwrap<{ departments: Department[]; subDepartments: SubDepartment[] }>(axios.get(`${BASE}/dept-mgmt`)),
    department: (id: number) => unwrap<{ department: Department; subDepartments: SubDepartment[]; people: Person[] }>(axios.get(`${BASE}/dept-mgmt/departments/${id}`)),
    subDepartment: (id: number) => unwrap<{ subDepartment: SubDepartment; department: Department | null; people: Person[] }>(axios.get(`${BASE}/dept-mgmt/sub-departments/${id}`)),
    createDepartment: (d: DepartmentInput) => unwrap<{ id: number; code: string }>(axios.post(`${BASE}/dept-mgmt/departments`, d)),
    updateDepartment: (id: number, d: Partial<DepartmentInput> & { active?: boolean }) => axios.put(`${BASE}/dept-mgmt/departments/${id}`, d),
    createSub: (s: SubInput & { departmentId: number | null; people?: number[]; copyFrom?: number | null }) =>
        unwrap<{ id: number; code: string; copied: { tasks: number; targets: number; goals: number } | null }>(axios.post(`${BASE}/dept-mgmt/sub-departments`, s)),
    updateSub: (id: number, s: Partial<SubInput> & { departmentId?: number | null; active?: boolean }) => axios.put(`${BASE}/dept-mgmt/sub-departments/${id}`, s),
    removeSub: (id: number) => axios.delete(`${BASE}/dept-mgmt/sub-departments/${id}`),
    addPeople: (subId: number, userIds: number[]) => axios.post(`${BASE}/dept-mgmt/sub-departments/${subId}/people`, { userIds }),
    map: (items: { subDepartmentId: number; departmentId: number }[]) => axios.put(`${BASE}/dept-mgmt/mapping`, { items }),
    /** everyone who can be picked as a leader or moved in */
    candidates: async (): Promise<Candidate[]> => {
        const r = await axios.post(`${BASE}/users/read?page=0&size=0`, { filter: "", searchText: "", departmentID: null });
        return (r.data?.response?.users ?? []).map((u: any) => ({
            userId: Number(u.userID), name: u.userName, email: u.userEmail ?? "", active: u.newStatus === "Active",
            subDepartmentIds: (u.departments ?? []).map((d: any) => Number(d.departmentID)),
        }));
    },
};

export const errorText = (e: unknown) => {
    const r = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
    const first = r?.errors ? Object.values(r.errors)[0]?.[0] : undefined;
    return first ?? r?.message ?? "Something went wrong";
};

export const CRITERIA: { key: Criteria; label: string }[] = [
    { key: "DAILY", label: "Daily" }, { key: "WEEKLY", label: "Weekly" }, { key: "MONTHLY", label: "Monthly" }, { key: "QUARTERLY", label: "Quarterly" }, { key: "COMBINED", label: "Combined" },
];
export const criteriaLabel = (c: string | null | undefined) => CRITERIA.find((x) => x.key === c)?.label ?? "Not set";
