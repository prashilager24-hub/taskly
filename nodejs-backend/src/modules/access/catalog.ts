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
      { id: 'pms_my_quarter', label: 'Quarter Highlights', description: 'Write your own biggest achievement and biggest failure for each quarter; the quarterly review needs them' },
    ],
  },
  {
    id: 'appraisal', label: 'Appraisal', description: 'Yearly appraisal; each page below is its own permission and still shows only when there is something for the person to do', children: [
      { id: 'appr_my', label: 'My Appraisal', description: 'Their own appraisal, while their cycle is open' },
      { id: 'appr_overview', label: 'Appraisal Overview', description: 'How the appraisal is going in every department' },
      { id: 'appr_departments', label: 'Department Budgets', description: 'Give each department its budget (Finance)' },
      { id: 'appr_split', label: 'Budget Split', description: 'Split a department budget between FLs (when they are EL of a sub department)' },
      { id: 'appr_allocation', label: 'Team Allocation', description: 'Give hikes to their own people (when someone reports to them or they got a share)' },
      { id: 'appr_requests', label: 'Change Requests', description: 'Ask for or decide changes to a hike' },
      { id: 'appr_hr', label: 'HR Postponements', description: 'Follow up postponed appraisals (HR)' },
      { id: 'appr_setup', label: 'Appraisal Setup', description: 'Joining date, level and CTC; read to view, update to change' },
    ],
  },
  { id: 'pms_feedback', label: 'Manager Feedback Form', description: 'Write monthly feedback for a team member (its own menu item)' },
  {
    id: 'hrfeedback', label: 'HR Experience & Support', description: 'The HR Experience (onboarding, engagement) and Support (queries) menus; each page below is its own permission', children: [
      { id: 'hr_onboarding', label: 'Onboarding Experience', description: 'The onboarding survey (new joiners), and for HR the console to send it' },
      { id: 'hr_query', label: 'Query', description: 'Raise queries to HR, and for HR answer them' },
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

/** Appraisal pages the Admin does not get: Admin has no appraisal of their own and does not split or allocate budgets */
const NOT_FOR_ADMIN = new Set(['appr_my', 'appr_split', 'appr_allocation', 'appr_requests']);
/** Admin: every module; in the appraisal only Overview, Department Budgets, HR Postponements and Appraisal Setup (view only) */
export const FULL_ACCESS: Privileges = Object.fromEntries(MODULE_IDS.filter((m) => !NOT_FOR_ADMIN.has(m)).map((m) => [m, m === 'appr_setup' ? ['read'] : [...ACTIONS]])) as Privileges;
