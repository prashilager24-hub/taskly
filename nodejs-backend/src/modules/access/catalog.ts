/** Every module a role / department / user can be given, and the actions on each. One source for UI and checks. */
export const ACTIONS = ['read', 'create', 'update', 'delete'] as const;
export type Action = (typeof ACTIONS)[number];
export type Privileges = Record<string, Action[]>;

export interface ModuleDef { id: string; label: string; description: string; children?: ModuleDef[] }

export const CATALOG: ModuleDef[] = [
  {
    id: 'dashboard', label: 'Dashboard', description: 'Overview dashboard and the attention cards', children: [
      { id: 'perf_report', label: 'Performance Overview', description: '% of target and goal achieved and working hours for the whole company (Admins only)' },
    ],
  },
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
  // ── People Hub (ids match frontend/src/peoplehub/nav.ts: hubPageAccess / hubGroupAccess) ──
  {
    id: 'hubg_dashboard', label: 'People Hub: Dashboard', description: 'The Dashboard section of the People Hub menu; each page below is its own permission', children: [
      { id: 'hub_dashboard_hrms', label: 'HRMS Dashboard', description: 'People Hub page (sample data for now)' },
      { id: 'hub_dashboard_pms', label: 'PMS Dashboard', description: 'Avg Goal %, Avg Target % and the Model X PMS Score with charts (real data; self / team / company by the Hierarchy); leaders can shift a teammate’s weighting up to 5% a year' },
    ],
  },
  {
    id: 'hubg_pms', label: 'People Hub: PMS', description: 'The PMS section of the People Hub menu; each page below is its own permission', children: [
      { id: 'hub_taskly_worklog', label: 'Worklog', description: 'People Hub page (sample data for now) (on hold)' },
      { id: 'hub_taskly_goals', label: 'Target & Goals', description: 'Target and goal entries (real data); everyone adds their own targets, only Admins add goals' },
    ],
  },
  {
    id: 'hubg_growth_rewards', label: 'People Hub: Growth & Rewards', description: 'The Growth & Rewards section of the People Hub menu; each page below is its own permission', children: [
      { id: 'hub_pms_performance_bonus', label: 'Performance Bonus', description: 'People Hub page (sample data for now)' },
      { id: 'hub_pms_rnr', label: 'R&R', description: 'People Hub page (sample data for now)' },
    ],
  },
  {
    id: 'hubg_variable_pay', label: 'People Hub: Variable Pay', description: 'Variable pay based on the PMS score: each person appeals for a finished period if eligible; the Finance Head approves and pays', children: [
      { id: 'hub_variable_pay_my', label: 'My Variable Pay', description: 'Their PMS score, eligibility and payout for each period; create to appeal' },
      { id: 'hub_variable_pay_team', label: 'Team Variable Pay', description: 'Managers: their team\u2019s variable pay status (read only; nobody in the team approves)' },
      { id: 'hub_variable_pay_finance', label: 'Variable Pay Overview', description: 'Every employee\u2019s variable pay by year / quarter; approve appeals, send back, mark paid (Finance Head and Admin)' },
      { id: 'hub_variable_pay_policy', label: 'Policy & Slabs', description: 'The payout slabs and the variable % by level; update to change the slabs' },
      { id: 'hub_variable_pay_eligibility', label: 'Eligibility', description: 'Each person’s cycle, CTC-based target variable and any override (HR); update to change' },
    ],
  },
  {
    id: 'hubg_hrms', label: 'People Hub: HRMS', description: 'The HRMS section of the People Hub menu; each page below is its own permission', children: [
      { id: 'hub_hrms_onboarding', label: 'Onboarding', description: 'People Hub page (sample data for now)' },
      { id: 'hub_hrms_probation', label: 'Probation', description: 'People Hub page (sample data for now)' },
      { id: 'hub_hrms_exit', label: 'Exit (F&F)', description: 'People Hub page (sample data for now)' },
      { id: 'hub_hrms_leave_attendance', label: 'Leave & Attendance', description: 'People Hub page (sample data for now)' },
      { id: 'hub_hrms_internal_movements', label: 'Internal Movements', description: 'People Hub page (sample data for now)' },
      { id: 'hub_hrms_payroll', label: 'Payroll', description: 'People Hub page (sample data for now)' },
      { id: 'hub_hrms_salary_slips', label: 'Salary Slips', description: 'People Hub page (sample data for now)' },
      { id: 'hub_hrms_loans', label: 'Loans & Salary Advance', description: 'People Hub page (sample data for now)' },
      { id: 'hub_hrms_reimbursements', label: 'Reimbursements', description: 'People Hub page (sample data for now)' },
      { id: 'hub_hrms_it_declaration', label: 'IT Declaration', description: 'People Hub page (sample data for now)' },
      { id: 'hub_hrms_documents', label: 'Document Centre', description: 'People Hub page (sample data for now)' },
      { id: 'hub_hrms_reports', label: 'Reports', description: 'People Hub page (sample data for now)' },
    ],
  },
  {
    id: 'hubg_l_d', label: 'People Hub: L&D', description: 'The L&D section of the People Hub menu; each page below is its own permission', children: [
      { id: 'hub_ld_training', label: 'Training Modules', description: 'People Hub page (sample data for now)' },
      { id: 'hub_ld_feedback', label: 'Employee Feedback (30/60/90)', description: 'People Hub page (sample data for now)' },
      { id: 'hub_ld_pip', label: 'PIP', description: 'People Hub page (sample data for now)' },
    ],
  },
  {
    id: 'hubg_talent_acquisition', label: 'People Hub: Talent Acquisition', description: 'The Talent Acquisition section of the People Hub menu; each page below is its own permission', children: [
      { id: 'hub_talent_open_roles', label: 'Open Roles', description: 'People Hub page (sample data for now)' },
      { id: 'hub_talent_interview_tracker', label: 'Interview Tracker', description: 'People Hub page (sample data for now)' },
      { id: 'hub_talent_interview_stages', label: 'Interview Stages', description: 'People Hub page (sample data for now)' },
      { id: 'hub_talent_employee_database', label: 'Employee Database', description: 'People Hub page (sample data for now)' },
      { id: 'hub_talent_offer_letter', label: 'Offer Letter Generation', description: 'People Hub page (sample data for now)' },
      { id: 'hub_talent_new_hire', label: 'New Hire Notification', description: 'People Hub page (sample data for now)' },
    ],
  },
  {
    id: 'hubg_assets_it', label: 'People Hub: Assets & IT', description: 'The Assets & IT section of the People Hub menu; each page below is its own permission', children: [
      { id: 'hub_assets_issuance', label: 'Asset Issuance', description: 'People Hub page (sample data for now)' },
      { id: 'hub_assets_insurance', label: 'Insurance', description: 'People Hub page (sample data for now)' },
      { id: 'hub_assets_it_support', label: 'IT Troubleshooting', description: 'People Hub page (sample data for now)' },
      { id: 'hub_assets_overrides', label: 'Override Options', description: 'People Hub page (sample data for now)' },
      { id: 'hub_assets_id_card', label: 'ID Card Generation & QR', description: 'People Hub page (sample data for now)' },
    ],
  },
  {
    id: 'hubg_finance', label: 'People Hub: Finance', description: 'The Finance section of the People Hub menu; each page below is its own permission', children: [
      { id: 'hub_finance_payroll', label: 'Payroll', description: 'People Hub page (sample data for now)' },
      { id: 'hub_finance_payslips', label: 'Payslips', description: 'People Hub page (sample data for now)' },
      { id: 'hub_finance_it_declaration', label: 'IT Declaration', description: 'People Hub page (sample data for now)' },
      { id: 'hub_finance_loans', label: 'Loans & Salary Advance', description: 'People Hub page (sample data for now)' },
      { id: 'hub_finance_reimbursements', label: 'Reimbursements', description: 'People Hub page (sample data for now)' },
      { id: 'hub_finance_salary_revisions', label: 'Salary Revisions', description: 'People Hub page (sample data for now)' },
    ],
  },
  { id: 'hub_marketing', label: 'People Hub: Marketing & Events', description: 'People Hub page (sample data for now)' },
  { id: 'hub_outings', label: 'People Hub: Quarterly Outing / Team Budget', description: 'People Hub page (sample data for now)' },
  { id: 'hub_ideabox', label: 'People Hub: Ideabox', description: 'People Hub page (sample data for now)' },
  { id: 'hub_brand_kit', label: 'People Hub: Brand Kit', description: 'People Hub page (sample data for now)' },
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
