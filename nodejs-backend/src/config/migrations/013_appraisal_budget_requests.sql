-- Appraisal, second round: department budgets (Finance -> EL -> FL) and the assessors' view of designation / team change requests.

-- What the FL and the EL say about each change the employee asked for. The EL also approves or rejects it.
CREATE TABLE AppraisalRequestReview (
  CycleID      INT NOT NULL,
  Field        ENUM('DESIGNATION','TEAM') NOT NULL,
  ReviewerRole ENUM('A1','A2') NOT NULL,
  Comment      TEXT NULL,
  Decision     ENUM('APPROVED','REJECTED') NULL,
  DecidedBy    INT NULL,
  UpdatedAt    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (CycleID, Field, ReviewerRole),
  CONSTRAINT fk_rr_cycle FOREIGN KEY (CycleID) REFERENCES AppraisalCycle(CycleID) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;

-- The hike budget Finance gives an EL for a department, per year. Annual rupees.
CREATE TABLE AppraisalBudget (
  BudgetYear   SMALLINT NOT NULL,
  DepartmentID INT NOT NULL,
  Amount       DECIMAL(14,2) NOT NULL,
  Comment      TEXT NULL,
  SetBy        INT NOT NULL,
  UpdatedAt    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (BudgetYear, DepartmentID)
) DEFAULT CHARSET=utf8mb4;

-- How the EL splits that budget between the Functional Leaders / Managers of the department
CREATE TABLE AppraisalBudgetAlloc (
  BudgetYear   SMALLINT NOT NULL,
  DepartmentID INT NOT NULL,
  FlUserID     INT NOT NULL,
  Amount       DECIMAL(14,2) NOT NULL,
  SetBy        INT NOT NULL,
  UpdatedAt    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (BudgetYear, DepartmentID, FlUserID)
) DEFAULT CHARSET=utf8mb4;
