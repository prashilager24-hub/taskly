/** Every module a role / department / user can be given, and the actions on each. One source for UI and checks. */
export const ACTIONS = ['read', 'create', 'update', 'delete'] as const;
export type Action = (typeof ACTIONS)[number];
export type Privileges = Record<string, Action[]>;

export interface ModuleDef { id: string; label: string; description: string; children?: ModuleDef[] }

export const CATALOG: ModuleDef[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Overview dashboard and the attention cards' },
  { id: 'dataentry', label: 'Daily Activity', description: 'Log and review daily task, target and goal entries' },
  {
    id: 'reports', label: 'Reports', description: 'The Reports section of the menu', children: [
      { id: 'perf', label: 'Performance Insights', description: 'Efficiency and utilization by person' },
      { id: 'mydata', label: 'User Data', description: 'Daily task reports per user' },
      { id: 'goals', label: 'Goals Achieved', description: 'Goal progress over time' },
      { id: 'entryApproval', label: 'Entry Approval', description: 'Approve or reject submitted entries' },
      { id: 'userHistory', label: 'User History', description: 'History of a user\'s entries' },
      { id: 'queryReport', label: 'Query Report', description: 'Support queries report' },
    ],
  },
  { id: 'salesfwd', label: 'Sales Forward', description: 'Sales calls, accounts and follow-ups' },
  {
    id: 'admin', label: 'Admin', description: 'The Admin section of the menu', children: [
      { id: 'accessmgmt', label: 'Access Management', description: 'Roles, users, departments and sign-in security' },
      { id: 'deptmgmt', label: 'Departments', description: 'Primary and sub departments' },
      { id: 'taskmgmt', label: 'Task Management', description: 'Tasks people log against' },
      { id: 'targetmgmt', label: 'Target Management', description: 'Targets per department' },
      { id: 'goalmgmt', label: 'Goal Management', description: 'Goals per department' },
    ],
  },
  { id: 'pms', label: 'PMS', description: 'Goal setting, manager feedback, quarterly reviews and reports' },
  { id: 'hrfeedback', label: 'Support', description: 'Queries, onboarding experience and engagement' },
];

export const MODULE_IDS: string[] = CATALOG.flatMap((m) => [m.id, ...(m.children ?? []).map((c) => c.id)]);

/** Keeps only known modules / actions, de-duplicated; for allowed access any write action implies read */
export function normalize(input: unknown, implyRead = true): Privileges {
  const out: Privileges = {};
  if (!input || typeof input !== 'object') return out;
  for (const [mod, acts] of Object.entries(input as Record<string, unknown>)) {
    if (!MODULE_IDS.includes(mod) || !Array.isArray(acts)) continue;
    const set = new Set(acts.filter((a): a is Action => (ACTIONS as readonly string[]).includes(a as string)));
    if (!set.size) continue;
    if (implyRead) set.add('read');
    out[mod] = ACTIONS.filter((a) => set.has(a));
  }
  return out;
}

export const FULL_ACCESS: Privileges = Object.fromEntries(MODULE_IDS.map((m) => [m, [...ACTIONS]])) as Privileges;
