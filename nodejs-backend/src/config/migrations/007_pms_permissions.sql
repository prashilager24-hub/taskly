-- The PMS dashboard's Quarterly review and Manager feedback views are now their own permissions, and the
-- Manager Feedback form has its own menu item. Whoever can open the PMS dashboard keeps both views.
UPDATE AMRole SET RolePrivileges = JSON_SET(RolePrivileges, '$.pms_dash_quarterly', JSON_ARRAY('read'), '$.pms_dash_feedback', JSON_ARRAY('read'))
WHERE RolePrivileges IS NOT NULL AND RolePrivileges <> '' AND COALESCE(JSON_LENGTH(JSON_EXTRACT(RolePrivileges, '$.pms_dashboard')), 0) > 0
  AND JSON_EXTRACT(RolePrivileges, '$.pms_dash_quarterly') IS NULL AND JSON_EXTRACT(RolePrivileges, '$.pms_dash_feedback') IS NULL;

UPDATE DepartmentAccess SET Privileges = JSON_SET(Privileges, '$.pms_dash_quarterly', JSON_ARRAY('read'), '$.pms_dash_feedback', JSON_ARRAY('read'))
WHERE Privileges IS NOT NULL AND Privileges <> '' AND COALESCE(JSON_LENGTH(JSON_EXTRACT(Privileges, '$.pms_dashboard')), 0) > 0
  AND JSON_EXTRACT(Privileges, '$.pms_dash_quarterly') IS NULL AND JSON_EXTRACT(Privileges, '$.pms_dash_feedback') IS NULL;

UPDATE UserAccess SET Grants = JSON_SET(Grants, '$.pms_dash_quarterly', JSON_ARRAY('read'), '$.pms_dash_feedback', JSON_ARRAY('read'))
WHERE Grants IS NOT NULL AND Grants <> '' AND COALESCE(JSON_LENGTH(JSON_EXTRACT(Grants, '$.pms_dashboard')), 0) > 0
  AND JSON_EXTRACT(Grants, '$.pms_dash_quarterly') IS NULL AND JSON_EXTRACT(Grants, '$.pms_dash_feedback') IS NULL;
