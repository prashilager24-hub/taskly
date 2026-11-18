-- Dashboard → Performance Report (perf_report) is a new permission in Access Management.
-- Every role can open it; what they see is limited in the code: Admin / Super Admin the whole company,
-- everyone else their own data and their team's (people reporting to them, and the sub departments they lead as EL / FL).
-- Remove it from a role in Access Management to hide the page.
UPDATE AMRole SET RolePrivileges = JSON_SET(COALESCE(NULLIF(RolePrivileges, ''), '{}'), '$.perf_report', JSON_ARRAY('read'))
  WHERE IsRoleArchived = 0 AND RoleID <> 1;
