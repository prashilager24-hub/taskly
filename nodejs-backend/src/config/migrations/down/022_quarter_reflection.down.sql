-- Undo 022_quarter_reflection.sql. Run by hand; the migration runner never reads this folder.
-- Drops everyone's biggest achievement / failure notes.

UPDATE AMRole SET RolePrivileges = JSON_REMOVE(RolePrivileges, '$.pms_my_quarter')
WHERE RolePrivileges IS NOT NULL AND RolePrivileges <> '' AND JSON_VALID(RolePrivileges);
DROP TABLE IF EXISTS QuarterReflection;
