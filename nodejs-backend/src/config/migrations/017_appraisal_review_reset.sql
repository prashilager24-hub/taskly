-- Appraisal: variable pay override on every hike the EL / FL decides; the EL sends an FL's proposal back or resets the
-- whole split to the Finance Head's budget; a Super Administrator role that sees the appraisal overview of every department.

-- NULL: variable pay is the level's percentage; PCT / AMOUNT: whoever decided the hike set it (VariableValue is the % or ₹)
ALTER TABLE AppraisalAllocation ADD COLUMN VariableMode ENUM('PCT','AMOUNT') NULL AFTER AnnualAmount;
ALTER TABLE AppraisalAllocation ADD COLUMN VariableValue DECIMAL(14,2) NULL AFTER VariableMode;

-- "Revise proposal": the EL's note when sending an FL's allocation back
ALTER TABLE AppraisalShare ADD COLUMN ReturnComment TEXT NULL AFTER Justification;
ALTER TABLE AppraisalShare ADD COLUMN ReturnedAt DATETIME NULL AFTER ReturnComment;

-- "Reset budget": the EL takes the whole split back to the Finance Head's budget
ALTER TABLE AppraisalBudgetLog MODIFY Action ENUM('PROPOSED','REVISED','NEGOTIATE','ACCEPTED','RESET') NOT NULL;

INSERT INTO AMRole (RoleName, RoleDescription, RolePrivileges, RoleStatus, IsRoleArchived, RoleCreateTime, RoleModifyTime)
SELECT 'Super Administrator', 'Sees the appraisal overview of every department', '{"appraisal":["read"],"dashboard":["read"]}', 1, 0, NOW(), NOW() FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM AMRole WHERE RoleName = 'Super Administrator' AND IsRoleArchived = 0);
