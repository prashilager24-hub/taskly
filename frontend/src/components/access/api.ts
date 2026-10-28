import axios from "axios";

// Access Management API (/access/*). Responses are { status, response }; errors carry { message }.

const BASE = "/t2.0/authentificationUtilization";

export const ACTIONS = ["read", "create", "update", "delete"] as const;
export type Action = (typeof ACTIONS)[number];
export type Privileges = Record<string, Action[]>;

export interface ModuleDef { id: string; label: string; description: string; children?: ModuleDef[] }
export interface RoleRow { roleId: number; roleName: string; description: string; active: boolean; userCount: number; system: boolean; privileges: Privileges }
export interface DepartmentRow { departmentId: number; name: string; memberCount: number; privileges: Privileges }
export interface UserRow {
    userId: number; name: string; email: string; employeeId: string | null; roleId: number; roleName: string;
    secondaryRoleId: number | null; secondaryRoleName: string | null; active: boolean; departments: string[];
    twoFactor: "default" | "on" | "off"; twoFactorEffective: boolean; hasOverrides: boolean;
}
export interface ModuleExplain { id: string; role: Action[]; department: Action[]; grants: Action[]; denies: Action[]; effective: Action[] }
export interface UserExplain {
    roleNames: string[]; departments: { id: number; name: string }[]; isSuperAdmin: boolean;
    grants: Privileges; denies: Privileges; effective: Privileges; modules: ModuleExplain[];
}
export interface LogRow { id: number; target: string; summary: string; at: string; actor: string }

const unwrap = <T,>(p: Promise<{ data: { response: T } }>) => p.then((r) => r.data.response);

export const errorText = (err: any, fallback = "Something went wrong.") => err?.response?.data?.message || err?.message || fallback;

export const accessApi = {
    catalog: () => unwrap<ModuleDef[]>(axios.get(`${BASE}/access/catalog`)),
    roles: () => unwrap<RoleRow[]>(axios.get(`${BASE}/access/roles`)),
    saveRole: (role: { roleId?: number; roleName: string; description: string; active: boolean; privileges: Privileges }) =>
        role.roleId ? axios.put(`${BASE}/access/roles/${role.roleId}`, role) : axios.post(`${BASE}/access/roles`, role),
    deleteRole: (roleId: number) => axios.delete(`${BASE}/access/roles/${roleId}`),
    departments: () => unwrap<DepartmentRow[]>(axios.get(`${BASE}/access/departments`)),
    saveDepartment: (departmentId: number, privileges: Privileges) => axios.put(`${BASE}/access/departments/${departmentId}`, { privileges }),
    users: () => unwrap<UserRow[]>(axios.get(`${BASE}/access/users`)),
    explain: (userId: number) => unwrap<UserExplain>(axios.get(`${BASE}/access/users/${userId}`)),
    saveUserAccess: (userId: number, grants: Privileges, denies: Privileges) => unwrap<UserExplain>(axios.put(`${BASE}/access/users/${userId}`, { grants, denies })),
    setTwoFactor: (userIds: number[], value: "default" | "on" | "off") => axios.put(`${BASE}/access/users/two-factor`, { userIds, value }),
    security: () => unwrap<{ twoFactorDefault: "on" | "off"; totals: { users: number; withTwoFactor: number; withoutTwoFactor: number } }>(axios.get(`${BASE}/access/security`)),
    setDefaultTwoFactor: (value: "on" | "off") => axios.put(`${BASE}/access/security`, { twoFactorDefault: value }),
    log: () => unwrap<LogRow[]>(axios.get(`${BASE}/access/log`)),
};

export const flatModules = (catalog: ModuleDef[]) => catalog.flatMap((m) => [m, ...(m.children ?? [])]);
export const countModules = (p: Privileges) => Object.values(p).filter((a) => a.length).length;
