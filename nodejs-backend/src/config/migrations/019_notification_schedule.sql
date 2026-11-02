-- Notifications: where each one comes from, when it goes out (now, at a set time, or every week), and whether it is
-- emailed too. The Notifications page manages only the ones people write; appraisal notifications stay out of it.

-- MANUAL: written on the Notifications page · APPRAISAL: sent by the appraisal flow · SYSTEM: sent by a scheduled job
ALTER TABLE Notification ADD COLUMN Source VARCHAR(20) NOT NULL DEFAULT 'MANUAL';
-- Scheduled once: it goes out at SendAt. NULL: it went out when it was saved.
ALTER TABLE Notification ADD COLUMN SendAt DATETIME NULL;
-- NONE, or WEEKLY on RepeatDay (1 = Monday … 7 = Sunday) at RepeatTime ('HH:MM', India time)
ALTER TABLE Notification ADD COLUMN RepeatRule VARCHAR(10) NOT NULL DEFAULT 'NONE';
ALTER TABLE Notification ADD COLUMN RepeatDay TINYINT NULL;
ALTER TABLE Notification ADD COLUMN RepeatTime CHAR(5) NULL;
ALTER TABLE Notification ADD COLUMN SendEmail TINYINT(1) NOT NULL DEFAULT 0;
-- When it last went out to the bells (and by email); NULL: not yet
ALTER TABLE Notification ADD COLUMN DeliveredAt DATETIME NULL;
ALTER TABLE Notification ADD COLUMN EmailedCount INT NOT NULL DEFAULT 0;

UPDATE Notification SET Source = 'APPRAISAL' WHERE LinkUrl LIKE '/appraisal%';
UPDATE Notification SET DeliveredAt = CreatedAt WHERE DeliveredAt IS NULL;

-- Admin down to Lead can open Notifications and send them (Executive Leader, Functional Leader, Manager, Lead)
UPDATE AMRole SET RolePrivileges = JSON_SET(COALESCE(NULLIF(RolePrivileges, ''), '{}'), '$.notifications', JSON_ARRAY('read', 'create', 'update', 'delete'))
 WHERE RoleName IN ('ExecutiveLeader', 'FunctionalLeader', 'Manager', 'Lead') AND IsRoleArchived = 0;
