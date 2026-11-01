-- Appraisal: the EL accepts the Finance Head's budget or negotiates it (every step logged with a comment) before splitting it;
-- an employee may set their own variable pay on the hikes they appeal for.

-- BUDGET_WITH_EL now means "proposed, waiting for the EL"; BUDGET_NEGOTIATION "the EL asked the Finance Head to change it";
-- BUDGET_ACCEPTED "agreed, the EL can split it"
ALTER TABLE AppraisalRound MODIFY Status ENUM('COLLECTING','READY_FOR_FINANCE','BUDGET_WITH_EL','BUDGET_NEGOTIATION','BUDGET_ACCEPTED','SHARES_WITH_FLS','FINALISED') NOT NULL DEFAULT 'COLLECTING';
ALTER TABLE AppraisalRound ADD COLUMN ElAcceptedAt DATETIME NULL AFTER BudgetSetAt;

-- Every budget step between the Finance Head and the EL, oldest first
CREATE TABLE AppraisalBudgetLog (
  LogID      INT AUTO_INCREMENT PRIMARY KEY,
  RoundID    INT NOT NULL,
  ActorID    INT NULL,
  Action     ENUM('PROPOSED','REVISED','NEGOTIATE','ACCEPTED') NOT NULL,
  Amount     DECIMAL(14,2) NULL,
  Comment    TEXT NULL,
  CreatedAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_round (RoundID),
  CONSTRAINT fk_blog_round FOREIGN KEY (RoundID) REFERENCES AppraisalRound(RoundID) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;

-- A budget already split counts as accepted
UPDATE AppraisalRound SET ElAcceptedAt = COALESCE(ElSentAt, BudgetSetAt) WHERE Status IN ('SHARES_WITH_FLS','FINALISED');

-- NULL: variable pay is the level's percentage; PCT / AMOUNT: the employee set it themselves
ALTER TABLE AppraisalHike ADD COLUMN VariableOverride ENUM('PCT','AMOUNT') NULL AFTER VariablePct;
