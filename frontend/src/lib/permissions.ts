// Reads the signed-in user's role privileges (stored at login as `roles`).
// One place for UI permission checks; the backend still enforces access on every API.

export type Action = "read" | "create" | "update" | "delete";

function privileges(): Record<string, string[]> {
    try {
        const role = JSON.parse(localStorage.getItem("roles") || "{}");
        return JSON.parse(role.rolePrivileges || "{}");
    } catch {
        return {};
    }
}

export function hasModuleAccess(module: string, action: Action = "read"): boolean {
    return privileges()[module]?.includes(action) ?? false;
}

/** Whether the module appears in this session's privileges at all (a session from before the module existed lacks it) */
export function hasModuleKey(module: string): boolean {
    return module in privileges();
}

/** Admin / Super Admin (role 1), from the signed-in user saved at login */
export function isAdminUser(): boolean {
    try {
        return Number(JSON.parse(localStorage.getItem("authUserLD") || "{}").userRole) === 1;
    } catch {
        return false;
    }
}

/** Where the app opens after sign-in (and the logo goes): People Hub's PMS Dashboard, or the Taskly dashboard for anyone without it */
export function homePath(): string {
    return hasModuleAccess("hub_dashboard_pms") ? "/hub/dashboard/pms" : "/dashboard";
}
