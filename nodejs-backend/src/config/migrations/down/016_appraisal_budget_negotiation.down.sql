-- Undo 016_appraisal_budget_negotiation.sql. Run by hand, before the 015 down script when going back to appraisal-module.
-- The migration runner never reads this folder.

ALTER TABLE AppraisalHike DROP COLUMN VariableOverride;
DROP TABLE IF EXISTS AppraisalBudgetLog;
-- a budget waiting on or agreed by the EL goes back to "with the EL"
UPDATE AppraisalRound SET Status = 'BUDGET_WITH_EL' WHERE Status IN ('BUDGET_NEGOTIATION','BUDGET_ACCEPTED');
ALTER TABLE AppraisalRound DROP COLUMN ElAcceptedAt;
ALTER TABLE AppraisalRound MODIFY Status ENUM('COLLECTING','READY_FOR_FINANCE','BUDGET_WITH_EL','SHARES_WITH_FLS','FINALISED') NOT NULL DEFAULT 'COLLECTING';

DELETE FROM SchemaMigration WHERE Name = '016_appraisal_budget_negotiation.sql';
