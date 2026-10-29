-- Sales Forward is no longer used: drop its module from every stored access grant
UPDATE AMRole SET RolePrivileges = JSON_REMOVE(RolePrivileges, '$.salesfwd')
WHERE RolePrivileges IS NOT NULL AND RolePrivileges <> '' AND JSON_EXTRACT(RolePrivileges, '$.salesfwd') IS NOT NULL;

UPDATE DepartmentAccess SET Privileges = JSON_REMOVE(Privileges, '$.salesfwd')
WHERE Privileges IS NOT NULL AND Privileges <> '' AND JSON_EXTRACT(Privileges, '$.salesfwd') IS NOT NULL;

UPDATE UserAccess SET Grants = JSON_REMOVE(Grants, '$.salesfwd')
WHERE Grants IS NOT NULL AND Grants <> '' AND JSON_EXTRACT(Grants, '$.salesfwd') IS NOT NULL;

UPDATE UserAccess SET Denies = JSON_REMOVE(Denies, '$.salesfwd')
WHERE Denies IS NOT NULL AND Denies <> '' AND JSON_EXTRACT(Denies, '$.salesfwd') IS NOT NULL;
