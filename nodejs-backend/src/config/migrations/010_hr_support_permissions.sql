-- HR Support's three pages (Onboarding Experience, Query & HR, Employee Engagement) are now their own permissions.
-- Whoever had Support keeps all three, with the same actions.
UPDATE AMRole SET RolePrivileges = JSON_SET(RolePrivileges, '$.hr_onboarding', JSON_EXTRACT(RolePrivileges, '$.hrfeedback'), '$.hr_query', JSON_EXTRACT(RolePrivileges, '$.hrfeedback'), '$.hr_engagement', JSON_EXTRACT(RolePrivileges, '$.hrfeedback'))
WHERE RolePrivileges IS NOT NULL AND RolePrivileges <> '' AND COALESCE(JSON_LENGTH(JSON_EXTRACT(RolePrivileges, '$.hrfeedback')), 0) > 0
  AND JSON_EXTRACT(RolePrivileges, '$.hr_onboarding') IS NULL AND JSON_EXTRACT(RolePrivileges, '$.hr_query') IS NULL AND JSON_EXTRACT(RolePrivileges, '$.hr_engagement') IS NULL;

UPDATE DepartmentAccess SET Privileges = JSON_SET(Privileges, '$.hr_onboarding', JSON_EXTRACT(Privileges, '$.hrfeedback'), '$.hr_query', JSON_EXTRACT(Privileges, '$.hrfeedback'), '$.hr_engagement', JSON_EXTRACT(Privileges, '$.hrfeedback'))
WHERE Privileges IS NOT NULL AND Privileges <> '' AND COALESCE(JSON_LENGTH(JSON_EXTRACT(Privileges, '$.hrfeedback')), 0) > 0
  AND JSON_EXTRACT(Privileges, '$.hr_onboarding') IS NULL AND JSON_EXTRACT(Privileges, '$.hr_query') IS NULL AND JSON_EXTRACT(Privileges, '$.hr_engagement') IS NULL;

UPDATE UserAccess SET Grants = JSON_SET(Grants, '$.hr_onboarding', JSON_EXTRACT(Grants, '$.hrfeedback'), '$.hr_query', JSON_EXTRACT(Grants, '$.hrfeedback'), '$.hr_engagement', JSON_EXTRACT(Grants, '$.hrfeedback'))
WHERE Grants IS NOT NULL AND Grants <> '' AND COALESCE(JSON_LENGTH(JSON_EXTRACT(Grants, '$.hrfeedback')), 0) > 0
  AND JSON_EXTRACT(Grants, '$.hr_onboarding') IS NULL AND JSON_EXTRACT(Grants, '$.hr_query') IS NULL AND JSON_EXTRACT(Grants, '$.hr_engagement') IS NULL;
