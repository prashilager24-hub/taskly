-- User types and user roles. Old roles keep their names and ids (the app's logic and old data hang on them);
-- each one is grouped under one of the user types instead. Undo: down/020_user_types_and_roles.down.sql

-- User type: the access level a role gives
--   SUPER_ADMIN (Super Administrator) · ADMIN (Admin, Finance, HR) · EL (ExecutiveLeader, Executive) · FL (FunctionalLeader)
--   MANAGER (Manager) · LEAD (Lead) · ASSOCIATE (normalUser) · INTERN (Intern)
ALTER TABLE AMRole ADD COLUMN UserType VARCHAR(20) NULL;
UPDATE AMRole SET UserType = CASE RoleName
    WHEN 'Super Administrator' THEN 'SUPER_ADMIN'
    WHEN 'Admin' THEN 'ADMIN' WHEN 'Finance' THEN 'ADMIN' WHEN 'HR' THEN 'ADMIN'
    WHEN 'ExecutiveLeader' THEN 'EL' WHEN 'Executive' THEN 'EL'
    WHEN 'FunctionalLeader' THEN 'FL'
    WHEN 'Manager' THEN 'MANAGER'
    WHEN 'Lead' THEN 'LEAD'
    WHEN 'normalUser' THEN 'ASSOCIATE'
    WHEN 'Intern' THEN 'INTERN'
  END
 WHERE UserType IS NULL;

-- User role: a position a person holds on top of their user type (CEO, CBO, FINANCE_HEAD, HR_MANAGER); NULL for most
ALTER TABLE Users ADD COLUMN UserRole VARCHAR(20) NULL;
-- The Finance Head is the EL of Strategic Financial Management (the appraisal already treats them so)
UPDATE Users u JOIN Department d ON d.ExecutiveLeaderID = u.UserID
   SET u.UserRole = 'FINANCE_HEAD'
 WHERE d.DepartmentName = 'Strategic Financial Management' AND d.IsDepartmentArchived = 0 AND u.UserRole IS NULL;
