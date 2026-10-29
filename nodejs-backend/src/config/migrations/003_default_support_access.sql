-- Support (hrfeedback) used to be open to everyone; keep that as an explicit default for the existing roles
UPDATE AMRole
SET RolePrivileges = JSON_SET(COALESCE(NULLIF(RolePrivileges, ''), '{}'), '$.hrfeedback', JSON_ARRAY('read', 'create'))
WHERE RoleID <> 1 AND JSON_EXTRACT(COALESCE(NULLIF(RolePrivileges, ''), '{}'), '$.hrfeedback') IS NULL;
