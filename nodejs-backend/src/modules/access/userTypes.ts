/**
 * User types: the access level a person's role gives. Every role row (AMRole) belongs to one, so the old roles
 * (normalUser, ExecutiveLeader, Finance, HR ...) keep their names and ids and are shown by their user type.
 * User roles: a position a person may hold on top of their user type.
 */
export const USER_TYPES = ['SUPER_ADMIN', 'ADMIN', 'EL', 'FL', 'MANAGER', 'LEAD', 'ASSOCIATE', 'INTERN'] as const;
export type UserType = (typeof USER_TYPES)[number];

export const USER_ROLES = ['CEO', 'CBO', 'FINANCE_HEAD', 'HR_MANAGER'] as const;
export type UserRole = (typeof USER_ROLES)[number];
