-- Appraisal flow v2 (Taskly - Appraisal Cycle Workflow): requests go up, money comes down.
-- Everyone appeals; when a department is complete the Finance Head sets its budget; the EL splits it (own hike,
-- direct reports, a share per FL); each FL allocates the share to the team and the EL approves; then the offers go out.

-- Each cycle belongs to one department and one April / October period, which together make the department's round.
-- The assessor review statuses are gone: after the appeal the person is SUBMITTED until their hike is approved.
ALTER TABLE AppraisalCycle
  MODIFY Status ENUM('EMPLOYEE_OPEN','ASSESSOR_OPEN','FINANCE_REVIEW','SUBMITTED','OFFERED','ACCEPTED','POSTPONED') NOT NULL DEFAULT 'EMPLOYEE_OPEN',
  ADD COLUMN DepartmentID INT NULL,
  ADD COLUMN PeriodStart DATE NULL;

UPDATE AppraisalCycle SET Status = 'SUBMITTED' WHERE Status IN ('ASSESSOR_OPEN', 'FINANCE_REVIEW');

ALTER TABLE AppraisalCycle
  MODIFY Status ENUM('EMPLOYEE_OPEN','SUBMITTED','OFFERED','ACCEPTED','POSTPONED') NOT NULL DEFAULT 'EMPLOYEE_OPEN';

-- An EL belongs to the department they lead; everyone else to their first department
UPDATE AppraisalCycle c SET DepartmentID = COALESCE(
  (SELECT MIN(d.DepartmentID) FROM Department d WHERE d.ExecutiveLeaderID = c.UserID AND d.IsDepartmentArchived = 0),
  (SELECT MIN(du.DepartmentID) FROM DepartmentUser du WHERE du.UserID = c.UserID));

-- The period is the latest 1 April / 1 October on or before the cycle start
UPDATE AppraisalCycle SET PeriodStart = CASE
  WHEN MONTH(CycleStartDate) >= 10 THEN STR_TO_DATE(CONCAT(YEAR(CycleStartDate), '-10-01'), '%Y-%m-%d')
  WHEN MONTH(CycleStartDate) >= 4 THEN STR_TO_DATE(CONCAT(YEAR(CycleStartDate), '-04-01'), '%Y-%m-%d')
  ELSE STR_TO_DATE(CONCAT(YEAR(CycleStartDate) - 1, '-10-01'), '%Y-%m-%d') END;

ALTER TABLE AppraisalCycle ADD KEY ix_round (DepartmentID, PeriodStart);

-- One department's budget round per period: the Finance Head's budget and reason, then the EL's split
CREATE TABLE AppraisalRound (
  RoundID         INT AUTO_INCREMENT PRIMARY KEY,
  DepartmentID    INT NOT NULL,
  PeriodStart     DATE NOT NULL,
  Status          ENUM('COLLECTING','READY_FOR_FINANCE','BUDGET_WITH_EL','SHARES_WITH_FLS','FINALISED') NOT NULL DEFAULT 'COLLECTING',
  Budget          DECIMAL(14,2) NULL,
  FinanceComment  TEXT NULL,
  BudgetSetBy     INT NULL,
  BudgetSetAt     DATETIME NULL,
  ElSentAt        DATETIME NULL,
  ReadyAt         DATETIME NULL,
  UpdatedAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_round (DepartmentID, PeriodStart)
) DEFAULT CHARSET=utf8mb4;

-- The share of a round's budget an EL gives one FL, with the EL's note; then the FL's team proposal
CREATE TABLE AppraisalShare (
  RoundID        INT NOT NULL,
  FlUserID       INT NOT NULL,
  Amount         DECIMAL(14,2) NOT NULL DEFAULT 0,
  ElComment      TEXT NULL,
  Status         ENUM('PLANNED','SHARE_RECEIVED','DRAFT','SUBMITTED','APPROVED') NOT NULL DEFAULT 'PLANNED',
  Justification  TEXT NULL,
  SubmittedAt    DATETIME NULL,
  ApprovedAt     DATETIME NULL,
  ApprovedBy     INT NULL,
  UpdatedAt      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (RoundID, FlUserID),
  CONSTRAINT fk_share_round FOREIGN KEY (RoundID) REFERENCES AppraisalRound(RoundID) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;

-- The hike decided for one person in a round, by whom and why. It becomes the approved hike when it goes out.
CREATE TABLE AppraisalAllocation (
  CycleID       INT PRIMARY KEY,
  RoundID       INT NOT NULL,
  Source        ENUM('EL_OWN','EL_DIRECT','FL_TEAM','FL_OWN') NOT NULL,
  FlUserID      INT NULL,
  AnnualAmount  DECIMAL(14,2) NOT NULL,
  Reason        TEXT NULL,
  EnteredBy     INT NOT NULL,
  UpdatedAt     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_alloc_round (RoundID),
  CONSTRAINT fk_alloc_cycle FOREIGN KEY (CycleID) REFERENCES AppraisalCycle(CycleID) ON DELETE CASCADE,
  CONSTRAINT fk_alloc_round FOREIGN KEY (RoundID) REFERENCES AppraisalRound(RoundID) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;

-- An Associate / Intern request goes to their FL first: the FL's comment and recommendation (A1 row), then the EL decides (A2 row)
ALTER TABLE AppraisalRequestReview ADD COLUMN Recommendation ENUM('SUPPORT','NOT_SUPPORT') NULL;
