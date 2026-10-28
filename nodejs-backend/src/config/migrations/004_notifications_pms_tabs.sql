-- Notifications an admin sends to everyone, to departments, to roles or to named people
CREATE TABLE IF NOT EXISTS Notification (
  NotificationID INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  Title          VARCHAR(160) NOT NULL,
  Body           TEXT         NULL,
  Level          VARCHAR(16)  NOT NULL DEFAULT 'info',
  LinkUrl        VARCHAR(255) NULL,
  Audience       LONGTEXT     NOT NULL,
  ExpiresAt      DATETIME     NULL,
  IsActive       TINYINT(1)   NOT NULL DEFAULT 1,
  CreatedBy      INT          NULL,
  CreatedAt      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- A person's own state for a notification: read, or dismissed (closed) by them
CREATE TABLE IF NOT EXISTS NotificationState (
  NotificationID INT      NOT NULL,
  UserID         INT      NOT NULL,
  ReadAt         DATETIME NULL,
  DismissedAt    DATETIME NULL,
  PRIMARY KEY (NotificationID, UserID)
);

-- PMS tabs become their own modules, so each tab can be given by role, department or person.
-- Existing roles keep what they could already see: managers and sales only the Dashboard tab, others all but Report.
UPDATE AMRole
SET RolePrivileges = JSON_SET(RolePrivileges,
      '$.pms_dashboard', JSON_EXTRACT(RolePrivileges, '$.pms'))
WHERE RoleID <> 1 AND JSON_EXTRACT(COALESCE(NULLIF(RolePrivileges, ''), '{}'), '$.pms') IS NOT NULL
  AND JSON_EXTRACT(COALESCE(NULLIF(RolePrivileges, ''), '{}'), '$.pms_dashboard') IS NULL;

UPDATE AMRole
SET RolePrivileges = JSON_SET(RolePrivileges,
      '$.pms_goals', JSON_EXTRACT(RolePrivileges, '$.pms'),
      '$.pms_feedback', JSON_EXTRACT(RolePrivileges, '$.pms'),
      '$.pms_quarterly', JSON_EXTRACT(RolePrivileges, '$.pms'))
WHERE RoleID NOT IN (1, 2, 5) AND JSON_EXTRACT(COALESCE(NULLIF(RolePrivileges, ''), '{}'), '$.pms') IS NOT NULL
  AND JSON_EXTRACT(COALESCE(NULLIF(RolePrivileges, ''), '{}'), '$.pms_goals') IS NULL;

-- The PMS report stays with the department that owns it
INSERT INTO DepartmentAccess (DepartmentID, Privileges)
SELECT 16, '{"pms_report":["read"]}' FROM DUAL
WHERE EXISTS (SELECT 1 FROM Department WHERE DepartmentID = 16)
ON DUPLICATE KEY UPDATE Privileges = JSON_SET(COALESCE(NULLIF(Privileges, ''), '{}'), '$.pms_report', JSON_ARRAY('read'));
