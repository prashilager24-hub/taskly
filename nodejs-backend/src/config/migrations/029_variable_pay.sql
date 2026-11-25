-- People Hub → Variable Pay, the appraisal way: each person sends a request for their variable pay period (their
-- Users.VariableCycle: QUARTERLY / HALF_YEARLY / ANNUAL, default HALF_YEARLY). The PMS combined score for that period
-- (PMS Dashboard: weighted goal % and target % with the person's saved weights) picks the payout slab; the target
-- variable is CTC × the level's variable % (Associate 10, Manager 20, Head / EL 30) per period, or an HR override.
-- It then goes up the person's assessors (A1, then A2, as in the appraisal) and the Finance Head, who approves and
-- marks it paid. Every step is kept in VariablePayReview.

CREATE TABLE IF NOT EXISTS VariablePayRequest (
  RequestID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  UserID INT NOT NULL,
  PeriodKey VARCHAR(16) NOT NULL,            -- 2026-Q3, FY2026-H1 (Apr–Sep 2026), FY2025 (Apr 2025 – Mar 2026)
  PeriodStart DATE NOT NULL,
  PeriodEnd DATE NOT NULL,
  Cycle VARCHAR(16) NOT NULL,
  DepartmentID INT NULL,
  -- what was worked out when it was sent (kept as sent, so later edits to entries do not change a request in review)
  GoalPct DECIMAL(8,2) NULL,
  TargetPct DECIMAL(8,2) NULL,
  GoalWeight TINYINT UNSIGNED NOT NULL,
  Score DECIMAL(8,2) NULL,
  SlabPct DECIMAL(8,2) NOT NULL,
  TargetAmount DECIMAL(14,2) NOT NULL,       -- the 100 % payout for the period
  ComputedAmount DECIMAL(14,2) NOT NULL,     -- TargetAmount × SlabPct
  ProposedAmount DECIMAL(14,2) NOT NULL,     -- the amount the last reviewer agreed
  FinalAmount DECIMAL(14,2) NULL,            -- set by the Finance Head
  EmployeeNote TEXT NULL,
  Reviewers JSON NOT NULL,                   -- [A1, A2] user ids at the time it was sent
  StepIndex TINYINT UNSIGNED NOT NULL DEFAULT 0,
  Status VARCHAR(20) NOT NULL,               -- WITH_REVIEWER, WITH_FINANCE, APPROVED, PAID, RETURNED
  ReturnedTo VARCHAR(10) NULL,               -- EMPLOYEE when sent back to the person
  SubmittedAt DATETIME NOT NULL,
  PaidOn DATE NULL,
  UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vp_user_period (UserID, PeriodKey),
  KEY ix_vp_status (Status, PeriodKey)
);

CREATE TABLE IF NOT EXISTS VariablePayReview (
  ReviewID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  RequestID INT NOT NULL,
  ActorID INT NULL,
  Step VARCHAR(12) NOT NULL,                 -- EMPLOYEE, A1, A2, FINANCE
  Action VARCHAR(12) NOT NULL,               -- SENT, RESENT, APPROVED, RETURNED, PAID
  Amount DECIMAL(14,2) NULL,
  Comment TEXT NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_vpr_request (RequestID)
);

-- HR's override of a person's annual target variable (instead of CTC × level %)
CREATE TABLE IF NOT EXISTS VariablePayTarget (
  UserID INT NOT NULL PRIMARY KEY,
  AnnualVariable DECIMAL(14,2) NOT NULL,
  Note VARCHAR(500) NULL,
  UpdatedBy INT NULL,
  UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Payout slabs (Policy & Slabs page): score from (inclusive) → to (exclusive, null = no upper end) pays `payout` % of
-- the target variable; payout null = paid at the score, capped at `cap` %.
INSERT IGNORE INTO AppSetting (SettingKey, SettingValue) VALUES ('variablePaySlabs',
  '[{"from":0,"to":60,"payout":0},{"from":60,"to":75,"payout":50},{"from":75,"to":90,"payout":80},{"from":90,"to":100,"payout":100},{"from":100,"to":null,"payout":null,"cap":120}]');
