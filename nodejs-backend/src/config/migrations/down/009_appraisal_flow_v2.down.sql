-- Undo 009_appraisal_flow_v2.sql (only when going back to the branch appraisal-module).
-- Run by hand, e.g.: mysql -u taskly -p utilization < src/config/migrations/down/009_appraisal_flow_v2.down.sql
-- The migration runner never reads this folder.

DROP TABLE IF EXISTS AppraisalAllocation;
DROP TABLE IF EXISTS AppraisalShare;
DROP TABLE IF EXISTS AppraisalRound;
ALTER TABLE AppraisalRequestReview DROP COLUMN Recommendation;

ALTER TABLE AppraisalCycle MODIFY Status ENUM('EMPLOYEE_OPEN','ASSESSOR_OPEN','FINANCE_REVIEW','SUBMITTED','OFFERED','ACCEPTED','POSTPONED') NOT NULL DEFAULT 'EMPLOYEE_OPEN';
-- a v2 "submitted" appraisal goes back to the assessors
UPDATE AppraisalCycle SET Status = 'ASSESSOR_OPEN' WHERE Status = 'SUBMITTED';
ALTER TABLE AppraisalCycle MODIFY Status ENUM('EMPLOYEE_OPEN','ASSESSOR_OPEN','FINANCE_REVIEW','OFFERED','ACCEPTED','POSTPONED') NOT NULL DEFAULT 'EMPLOYEE_OPEN';
ALTER TABLE AppraisalCycle DROP KEY ix_round, DROP COLUMN PeriodStart, DROP COLUMN DepartmentID;

DELETE FROM SchemaMigration WHERE Name = '009_appraisal_flow_v2.sql';
