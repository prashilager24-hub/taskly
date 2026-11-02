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
  {
    id: 'datamgmt', label: 'Data Management', description: 'The Data Management section of the menu', children: [
      { id: 'taskmgmt', label: 'Task Management', description: 'Tasks people log against' },
      { id: 'targetmgmt', label: 'Target Management', description: 'Targets per department' },
      { id: 'goalmgmt', label: 'Goal Management', description: 'Goals per department, and acknowledging them' },
    ],
  },
  {
    id: 'admin', label: 'Admin', description: 'The Admin section of the menu', children: [
      { id: 'accessmgmt', label: 'Access Management', description: 'Roles, users, departments and sign-in security' },
      { id: 'deptmgmt', label: 'Departments', description: 'Primary and sub departments' },
      { id: 'notifications', label: 'Notifications', description: 'Send notifications to departments, roles or people' },
    ],
  },
  {
    id: 'pms', label: 'PMS', description: 'The PMS section of the menu; dashboard views and forms are separate permissions', children: [
      { id: 'pms_dashboard', label: 'PMS Dashboard', description: 'Opens the PMS dashboard' },
      { id: 'pms_dash_quarterly', label: 'Quarterly Review Dashboard', description: 'The quarterly reviews view of the PMS dashboard' },
      { id: 'pms_dash_feedback', label: 'Manager Feedback Dashboard', description: 'The manager feedback view of the PMS dashboard' },
      { id: 'pms_quarterly', label: 'Quarterly Review Form', description: 'Write and read quarterly reviews' },
      { id: 'pms_report', label: 'PMS Report', description: 'The review report tab' },
    ],
  },
  { id: 'pms_feedback', label: 'Manager Feedback Form', description: 'Write monthly feedback for a team member (its own menu item)' },
  {
    id: 'hrfeedback', label: 'HR Support', description: 'The HR Support section of the menu; each page below is its own permission', children: [
      { id: 'hr_onboarding', label: 'Onboarding Experience', description: 'The onboarding survey (new joiners), and for HR the console to send it' },
      { id: 'hr_query', label: 'Query & HR', description: 'Raise queries to HR, and for HR answer them' },
      { id: 'hr_engagement', label: 'Employee Engagement', description: 'Engagement surveys' },
      { id: 'hr_onb_templates', label: 'Onboarding Survey Templates', description: 'Add and edit onboarding survey templates and their questions (HR team by default)' },
      { id: 'hr_eng_templates', label: 'Engagement Survey Templates', description: 'Add and edit employee engagement survey templates and their questions (HR team by default)' },
    ],
  },
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
