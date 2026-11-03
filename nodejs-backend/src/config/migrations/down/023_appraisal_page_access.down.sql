-- Undo 023: drop the per-page appraisal permissions from every role (the Appraisal switch itself stays)
UPDATE AMRole SET RolePrivileges = JSON_REMOVE(RolePrivileges, '$.appr_my') WHERE JSON_CONTAINS_PATH(RolePrivileges, 'one', '$.appr_my');
UPDATE AMRole SET RolePrivileges = JSON_REMOVE(RolePrivileges, '$.appr_overview') WHERE JSON_CONTAINS_PATH(RolePrivileges, 'one', '$.appr_overview');
UPDATE AMRole SET RolePrivileges = JSON_REMOVE(RolePrivileges, '$.appr_departments') WHERE JSON_CONTAINS_PATH(RolePrivileges, 'one', '$.appr_departments');
UPDATE AMRole SET RolePrivileges = JSON_REMOVE(RolePrivileges, '$.appr_split') WHERE JSON_CONTAINS_PATH(RolePrivileges, 'one', '$.appr_split');
UPDATE AMRole SET RolePrivileges = JSON_REMOVE(RolePrivileges, '$.appr_allocation') WHERE JSON_CONTAINS_PATH(RolePrivileges, 'one', '$.appr_allocation');
UPDATE AMRole SET RolePrivileges = JSON_REMOVE(RolePrivileges, '$.appr_requests') WHERE JSON_CONTAINS_PATH(RolePrivileges, 'one', '$.appr_requests');
UPDATE AMRole SET RolePrivileges = JSON_REMOVE(RolePrivileges, '$.appr_hr') WHERE JSON_CONTAINS_PATH(RolePrivileges, 'one', '$.appr_hr');
UPDATE AMRole SET RolePrivileges = JSON_REMOVE(RolePrivileges, '$.appr_setup') WHERE JSON_CONTAINS_PATH(RolePrivileges, 'one', '$.appr_setup');
