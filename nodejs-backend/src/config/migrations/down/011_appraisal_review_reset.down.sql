-- Undo 011_appraisal_review_reset.sql. Run by hand, before the 010 down script when going back to appraisal-module.
-- The migration runner never reads this folder. The Super Administrator role stays if users still have it.

DELETE FROM AppraisalBudgetLog WHERE Action = 'RESET';
ALTER TABLE AppraisalBudgetLog MODIFY Action ENUM('PROPOSED','REVISED','NEGOTIATE','ACCEPTED') NOT NULL;
ALTER TABLE AppraisalShare DROP COLUMN ReturnedAt;
ALTER TABLE AppraisalShare DROP COLUMN ReturnComment;
ALTER TABLE AppraisalAllocation DROP COLUMN VariableValue;
ALTER TABLE AppraisalAllocation DROP COLUMN VariableMode;
UPDATE AMRole SET IsRoleArchived = 1, RoleStatus = 0 WHERE RoleName = 'Super Administrator' AND NOT EXISTS (SELECT 1 FROM Users WHERE RoleID = AMRole.RoleID AND IsUserArchived = 0);

DELETE FROM SchemaMigration WHERE Name = '011_appraisal_review_reset.sql';
