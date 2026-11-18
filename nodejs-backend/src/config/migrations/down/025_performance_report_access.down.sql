-- Undo 025: take Performance Report off every role
UPDATE AMRole SET RolePrivileges = JSON_REMOVE(RolePrivileges, '$.perf_report')
  WHERE RolePrivileges IS NOT NULL AND RolePrivileges <> '' AND JSON_CONTAINS_PATH(RolePrivileges, 'one', '$.perf_report');
