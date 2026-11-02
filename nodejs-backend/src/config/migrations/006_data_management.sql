-- Goal Setting is gone from PMS: drop its module from every stored access grant
UPDATE AMRole SET RolePrivileges = JSON_REMOVE(RolePrivileges, '$.pms_goals')
WHERE RolePrivileges IS NOT NULL AND RolePrivileges <> '' AND JSON_EXTRACT(RolePrivileges, '$.pms_goals') IS NOT NULL;

UPDATE DepartmentAccess SET Privileges = JSON_REMOVE(Privileges, '$.pms_goals')
WHERE Privileges IS NOT NULL AND Privileges <> '' AND JSON_EXTRACT(Privileges, '$.pms_goals') IS NOT NULL;

UPDATE UserAccess SET Grants = JSON_REMOVE(Grants, '$.pms_goals')
WHERE Grants IS NOT NULL AND Grants <> '' AND JSON_EXTRACT(Grants, '$.pms_goals') IS NOT NULL;

UPDATE UserAccess SET Denies = JSON_REMOVE(Denies, '$.pms_goals')
WHERE Denies IS NOT NULL AND Denies <> '' AND JSON_EXTRACT(Denies, '$.pms_goals') IS NOT NULL;

-- Task / Target / Goal Management now sit under a Data Management group: whoever really has one of them
-- (a non-empty grant, not just the key) gets the group. Start clean so this is safe to run again.
UPDATE AMRole SET RolePrivileges = JSON_REMOVE(RolePrivileges, '$.datamgmt')
WHERE RolePrivileges IS NOT NULL AND RolePrivileges <> '' AND JSON_EXTRACT(RolePrivileges, '$.datamgmt') IS NOT NULL;
UPDATE DepartmentAccess SET Privileges = JSON_REMOVE(Privileges, '$.datamgmt')
WHERE Privileges IS NOT NULL AND Privileges <> '' AND JSON_EXTRACT(Privileges, '$.datamgmt') IS NOT NULL;
UPDATE UserAccess SET Grants = JSON_REMOVE(Grants, '$.datamgmt')
WHERE Grants IS NOT NULL AND Grants <> '' AND JSON_EXTRACT(Grants, '$.datamgmt') IS NOT NULL;

UPDATE AMRole SET RolePrivileges = JSON_SET(RolePrivileges, '$.datamgmt', JSON_ARRAY('read'))
WHERE RolePrivileges IS NOT NULL AND RolePrivileges <> ''
  AND (COALESCE(JSON_LENGTH(JSON_EXTRACT(RolePrivileges, '$.taskmgmt')), 0) > 0 OR COALESCE(JSON_LENGTH(JSON_EXTRACT(RolePrivileges, '$.targetmgmt')), 0) > 0 OR COALESCE(JSON_LENGTH(JSON_EXTRACT(RolePrivileges, '$.goalmgmt')), 0) > 0);

UPDATE DepartmentAccess SET Privileges = JSON_SET(Privileges, '$.datamgmt', JSON_ARRAY('read'))
WHERE Privileges IS NOT NULL AND Privileges <> ''
  AND (COALESCE(JSON_LENGTH(JSON_EXTRACT(Privileges, '$.taskmgmt')), 0) > 0 OR COALESCE(JSON_LENGTH(JSON_EXTRACT(Privileges, '$.targetmgmt')), 0) > 0 OR COALESCE(JSON_LENGTH(JSON_EXTRACT(Privileges, '$.goalmgmt')), 0) > 0);

UPDATE UserAccess SET Grants = JSON_SET(Grants, '$.datamgmt', JSON_ARRAY('read'))
WHERE Grants IS NOT NULL AND Grants <> ''
  AND (COALESCE(JSON_LENGTH(JSON_EXTRACT(Grants, '$.taskmgmt')), 0) > 0 OR COALESCE(JSON_LENGTH(JSON_EXTRACT(Grants, '$.targetmgmt')), 0) > 0 OR COALESCE(JSON_LENGTH(JSON_EXTRACT(Grants, '$.goalmgmt')), 0) > 0);
