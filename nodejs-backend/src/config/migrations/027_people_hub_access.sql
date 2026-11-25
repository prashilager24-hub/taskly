-- People Hub modules are now permissions in Access Management (ids hubg_* for a menu group, hub_* for a page).
-- Super Admin / Admin (role 1, SUPER_ADMIN) get every module automatically.
-- Every other role except the admin-type roles (Finance, HR) gets the employee defaults below; everything else in
-- People Hub stays off until an Admin turns it on. Their existing Taskly access and Appraisal pages are not touched.
--   Dashboard → PMS Dashboard, PMS → Target & Goals (add own targets),
--   Variable Pay → My Variable Pay (send own request), Policy & Slabs.
UPDATE AMRole SET RolePrivileges = JSON_SET(COALESCE(NULLIF(RolePrivileges, ''), '{}'),
    '$.hubg_dashboard', JSON_ARRAY('read'),
    '$.hub_dashboard_pms', JSON_ARRAY('read'),
    '$.hubg_pms', JSON_ARRAY('read'),
    '$.hub_taskly_goals', JSON_ARRAY('read', 'create'),
    '$.hubg_variable_pay', JSON_ARRAY('read'),
    '$.hub_variable_pay_my', JSON_ARRAY('read', 'create'),
    '$.hub_variable_pay_policy', JSON_ARRAY('read'))
  WHERE IsRoleArchived = 0 AND RoleID <> 1 AND COALESCE(UserType, '') NOT IN ('ADMIN', 'SUPER_ADMIN');

-- Leaders review the variable pay requests of the people they assess (A1 / A2)
UPDATE AMRole SET RolePrivileges = JSON_SET(RolePrivileges, '$.hub_variable_pay_team', JSON_ARRAY('read', 'update'))
  WHERE IsRoleArchived = 0 AND UserType IN ('EL', 'FL', 'MANAGER', 'LEAD');

-- The Finance and HR roles (the Finance Head and the HR department also get these through Access Management defaults)
UPDATE AMRole SET RolePrivileges = JSON_SET(COALESCE(NULLIF(RolePrivileges, ''), '{}'),
    '$.hubg_variable_pay', JSON_ARRAY('read'), '$.hub_variable_pay_finance', JSON_ARRAY('read', 'create', 'update', 'delete'),
    '$.hub_variable_pay_eligibility', JSON_ARRAY('read'), '$.hub_variable_pay_policy', JSON_ARRAY('read'))
  WHERE IsRoleArchived = 0 AND RoleName = 'Finance';
UPDATE AMRole SET RolePrivileges = JSON_SET(COALESCE(NULLIF(RolePrivileges, ''), '{}'),
    '$.hubg_variable_pay', JSON_ARRAY('read'), '$.hub_variable_pay_eligibility', JSON_ARRAY('read', 'update'), '$.hub_variable_pay_policy', JSON_ARRAY('read'))
  WHERE IsRoleArchived = 0 AND RoleName = 'HR';
