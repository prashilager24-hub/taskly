-- Each Appraisal page is now its own permission in Access Management (appr_my … appr_setup).
-- Every role gets only the pages of its user type; anything more is given by hand in Access Management.
--   Super Admin      Overview, Appraisal Setup (view)
--   Admin            Overview, Department Budgets, HR Postponements, Appraisal Setup (view); the HR role can also change Setup
--   Executive Leader My Appraisal, Budget Split, Change Requests
--   Functional Leader My Appraisal, Team Allocation, Change Requests
--   Manager, Lead    My Appraisal, Team Allocation
--   Associate, Intern My Appraisal
-- The Admin role itself (RoleID 1) and the Finance Head / HR Operations duties are set in code (catalog.ts, access.service.ts).
UPDATE AMRole SET RolePrivileges = JSON_SET(COALESCE(NULLIF(RolePrivileges, ''), '{}'),
  '$.appraisal', JSON_ARRAY('read'), '$.appr_overview', JSON_ARRAY('read'), '$.appr_setup', JSON_ARRAY('read'))
  WHERE UserType = 'SUPER_ADMIN' AND RoleID <> 1;
UPDATE AMRole SET RolePrivileges = JSON_SET(COALESCE(NULLIF(RolePrivileges, ''), '{}'),
  '$.appraisal', JSON_ARRAY('read'), '$.appr_overview', JSON_ARRAY('read'), '$.appr_departments', JSON_ARRAY('read', 'create', 'update', 'delete'),
  '$.appr_hr', JSON_ARRAY('read', 'create', 'update', 'delete'), '$.appr_setup', JSON_ARRAY('read'))
  WHERE UserType = 'ADMIN' AND RoleID <> 1;
UPDATE AMRole SET RolePrivileges = JSON_SET(RolePrivileges, '$.appr_setup', JSON_ARRAY('read', 'update'))
  WHERE RoleName = 'HR' AND UserType = 'ADMIN';
UPDATE AMRole SET RolePrivileges = JSON_SET(COALESCE(NULLIF(RolePrivileges, ''), '{}'),
  '$.appraisal', JSON_ARRAY('read'), '$.appr_my', JSON_ARRAY('read', 'create', 'update'), '$.appr_split', JSON_ARRAY('read', 'create', 'update', 'delete'),
  '$.appr_requests', JSON_ARRAY('read', 'create', 'update'))
  WHERE UserType = 'EL';
UPDATE AMRole SET RolePrivileges = JSON_SET(COALESCE(NULLIF(RolePrivileges, ''), '{}'),
  '$.appraisal', JSON_ARRAY('read'), '$.appr_my', JSON_ARRAY('read', 'create', 'update'), '$.appr_allocation', JSON_ARRAY('read', 'create', 'update', 'delete'),
  '$.appr_requests', JSON_ARRAY('read', 'create', 'update'))
  WHERE UserType = 'FL';
UPDATE AMRole SET RolePrivileges = JSON_SET(COALESCE(NULLIF(RolePrivileges, ''), '{}'),
  '$.appraisal', JSON_ARRAY('read'), '$.appr_my', JSON_ARRAY('read', 'create', 'update'), '$.appr_allocation', JSON_ARRAY('read', 'create', 'update', 'delete'))
  WHERE UserType IN ('MANAGER', 'LEAD');
UPDATE AMRole SET RolePrivileges = JSON_SET(COALESCE(NULLIF(RolePrivileges, ''), '{}'),
  '$.appraisal', JSON_ARRAY('read'), '$.appr_my', JSON_ARRAY('read', 'create', 'update'))
  WHERE UserType IN ('ASSOCIATE', 'INTERN');
