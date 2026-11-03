-- Each employee writes their own biggest achievement and biggest failure for a quarter (one text each).
-- The manager's PMS Quarterly Review cannot be submitted until both are in; Appraisal reads them from here.
CREATE TABLE IF NOT EXISTS QuarterReflection (
  ReflectionID       INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  UserID             INT NOT NULL,
  Quarter            ENUM('Q1','Q2','Q3','Q4') NOT NULL,
  QuarterYear        SMALLINT NOT NULL,
  BiggestAchievement TEXT NOT NULL,
  BiggestFailure     TEXT NOT NULL,
  CreatedAt          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reflection_user_quarter (UserID, Quarter, QuarterYear),
  CONSTRAINT fk_reflection_user FOREIGN KEY (UserID) REFERENCES Users (UserID) ON DELETE CASCADE
);

-- A new "My Quarter Notes" page under PMS, open to every role (each person only ever sees and writes their own)
UPDATE AMRole SET RolePrivileges = JSON_SET(RolePrivileges, '$.pms_my_quarter', JSON_ARRAY('read', 'create', 'update'))
WHERE RolePrivileges IS NOT NULL AND RolePrivileges <> '' AND JSON_VALID(RolePrivileges)
  AND JSON_EXTRACT(RolePrivileges, '$.pms_my_quarter') IS NULL;
