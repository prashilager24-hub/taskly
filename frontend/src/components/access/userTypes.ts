/**
 * User types: the access level a person's role gives. The old roles keep their names (normalUser, ExecutiveLeader,
 * Finance, HR …) and are shown by the user type they belong to. User roles: a position held on top of the user type.
 */
export type UserType = "SUPER_ADMIN" | "ADMIN" | "EL" | "FL" | "MANAGER" | "LEAD" | "ASSOCIATE" | "INTERN";
export type UserRole = "CEO" | "CBO" | "FINANCE_HEAD" | "HR_MANAGER";

export const USER_TYPES: { key: UserType; label: string; short: string; hint: string }[] = [
    { key: "SUPER_ADMIN", label: "Super Admin", short: "SA", hint: "All access" },
    { key: "ADMIN", label: "Admin", short: "AD", hint: "Finance & HR" },
    { key: "EL", label: "Executive Leader", short: "EL", hint: "Leads departments" },
    { key: "FL", label: "Functional Leader", short: "FL", hint: "Leads a function" },
    { key: "MANAGER", label: "Manager", short: "MG", hint: "Manages a team" },
    { key: "LEAD", label: "Lead", short: "LD", hint: "Leads a small team" },
    { key: "ASSOCIATE", label: "Associate", short: "AS", hint: "Team member" },
    { key: "INTERN", label: "Intern", short: "IN", hint: "Intern" },
];

export const USER_ROLES: { key: UserRole; label: string }[] = [
    { key: "CEO", label: "CEO" },
    { key: "CBO", label: "CBO" },
    { key: "FINANCE_HEAD", label: "Finance Head" },
    { key: "HR_MANAGER", label: "HR Manager" },
];

// For screens that only get a role's name: the old role names and the user type each belongs to
const TYPE_OF_ROLE_NAME: Record<string, UserType> = {
    "Super Administrator": "SUPER_ADMIN", Admin: "ADMIN", Finance: "ADMIN", HR: "ADMIN", ExecutiveLeader: "EL", Executive: "EL",
    FunctionalLeader: "FL", Manager: "MANAGER", Lead: "LEAD", normalUser: "ASSOCIATE", Intern: "INTERN",
};

/** The user type's name, from the type when known, else from the role's name; a role outside the types keeps its own name */
export function userTypeLabel(userType?: string | null, roleName?: string | null) {
    const key = userType || (roleName ? TYPE_OF_ROLE_NAME[roleName] : undefined);
    return USER_TYPES.find((t) => t.key === key)?.label ?? roleName ?? "No role";
}

export const userRoleLabel = (userRole?: string | null) => USER_ROLES.find((r) => r.key === userRole)?.label ?? null;
