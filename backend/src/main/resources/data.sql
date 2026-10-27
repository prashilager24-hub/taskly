INSERT IGNORE INTO AMRole (RoleName, RolePrivileges, RoleStatus, IsRoleArchived, RoleDescription, RoleCreateTime, RoleModifyTime)
VALUES ('Intern', '{}', true, false, 'Intern role with limited access', NOW(), NOW());

INSERT IGNORE INTO AMRole (RoleName, RolePrivileges, RoleStatus, IsRoleArchived, RoleDescription, RoleCreateTime, RoleModifyTime)
VALUES ('Executive', '{}', true, false, 'Executive role with elevated access', NOW(), NOW());

INSERT IGNORE INTO AMRole (RoleName, RolePrivileges, RoleStatus, IsRoleArchived, RoleDescription, RoleCreateTime, RoleModifyTime)
VALUES ('Manager', '{}', true, false, 'Manager role with team management access', NOW(), NOW());

INSERT IGNORE INTO AMRole (RoleName, RolePrivileges, RoleStatus, IsRoleArchived, RoleDescription, RoleCreateTime, RoleModifyTime)
VALUES ('Lead', '{}', true, false, 'Lead role with team lead access', NOW(), NOW());
