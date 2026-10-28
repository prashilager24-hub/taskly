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
