-- Appraisal module (spec: Appraisal Module technical spec). Applied by: npm run db:migrate

-- Who is appraised and from when. Joining date and level did not exist on Users; CTC is reference only.
ALTER TABLE Users
  ADD COLUMN DateOfJoining DATE NULL,
  ADD COLUMN EmployeeLevel ENUM('ASSOCIATE','MANAGER','HEAD_EL') NULL,
  ADD COLUMN CurrentAnnualCtc DECIMAL(14,2) NULL;

-- Starting level from the role (Executive Leader = HEAD_EL, Functional Leader / Manager / Lead = MANAGER, everyone else = ASSOCIATE).
-- Admins are not appraised. HR can change a person's level later.
UPDATE Users SET EmployeeLevel = CASE
    WHEN RoleID = 3 THEN 'HEAD_EL'
    WHEN RoleID IN (4, 7, 23) THEN 'MANAGER'
    ELSE 'ASSOCIATE' END
WHERE RoleID <> 1 AND EmployeeLevel IS NULL;

CREATE TABLE AppraisalCycle (
  CycleID            INT AUTO_INCREMENT PRIMARY KEY,
  UserID             INT NOT NULL,
  CycleYear          SMALLINT NOT NULL,
  CycleStartDate     DATE NOT NULL,
  EmployeeWindowEnd  DATE NOT NULL,
  AssessorWindowEnd  DATE NOT NULL,
  Status             ENUM('EMPLOYEE_OPEN','ASSESSOR_OPEN','FINANCE_REVIEW','OFFERED','ACCEPTED','POSTPONED') NOT NULL DEFAULT 'EMPLOYEE_OPEN',
  EmployeeLevel      ENUM('ASSOCIATE','MANAGER','HEAD_EL') NOT NULL,
  VariablePct        TINYINT NOT NULL,
  Assessor1UserID    INT NULL,
  Assessor2UserID    INT NULL,
  CurrentAnnualCtc   DECIMAL(14,2) NULL,
  PostponedUntil     DATE NULL,
  CreatedAt          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_year (UserID, CycleYear),
  KEY ix_status (Status),
  CONSTRAINT fk_cycle_user FOREIGN KEY (UserID) REFERENCES Users(UserID)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE AppraisalQuarter (
  QuarterID           INT AUTO_INCREMENT PRIMARY KEY,
  CycleID             INT NOT NULL,
  Quarter             TINYINT NOT NULL,
  Goals               TEXT NULL,
  Targets             TEXT NULL,
  BiggestAchievements TEXT NULL,
  BiggestFailures     TEXT NULL,
  UNIQUE KEY uq_cycle_q (CycleID, Quarter),
  CONSTRAINT fk_q_cycle FOREIGN KEY (CycleID) REFERENCES AppraisalCycle(CycleID) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE AppraisalQuarterReview (
  ID           INT AUTO_INCREMENT PRIMARY KEY,
  CycleID      INT NOT NULL,
  Quarter      TINYINT NOT NULL,
  ReviewerRole ENUM('A1','A2') NOT NULL,
  FinalRating  DECIMAL(3,1) NULL,
  Comments     TEXT NULL,
  UNIQUE KEY uq_cycle_q_role (CycleID, Quarter, ReviewerRole),
  CONSTRAINT fk_qr_cycle FOREIGN KEY (CycleID) REFERENCES AppraisalCycle(CycleID) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE AppraisalReview (
  ReviewID        INT AUTO_INCREMENT PRIMARY KEY,
  CycleID         INT NOT NULL,
  ReviewerRole    ENUM('SELF','A1','A2','FINANCE') NOT NULL,
  AnswersJson     JSON NULL,
  OverallRating   DECIMAL(3,1) NULL,
  Comment         TEXT NULL,
  ManagerFeedback TEXT NULL,
  SubmittedAt     DATETIME NULL,
  UpdatedAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cycle_role (CycleID, ReviewerRole),
  CONSTRAINT fk_r_cycle FOREIGN KEY (CycleID) REFERENCES AppraisalCycle(CycleID) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE AppraisalHike (
  HikeID         INT AUTO_INCREMENT PRIMARY KEY,
  CycleID        INT NOT NULL,
  Kind           ENUM('EXPECTED','TARGET','MINIMAL','APPROVED') NOT NULL,
  ByRole         ENUM('EMPLOYEE','A1','A2','FINANCE') NOT NULL,
  AnnualAmount   DECIMAL(14,2) NOT NULL,
  FixedAmount    DECIMAL(14,2) NOT NULL,
  VariableAmount DECIMAL(14,2) NOT NULL,
  VariablePct    TINYINT NOT NULL,
  EnteredBy      INT NOT NULL,
  UpdatedAt      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cycle_kind_role (CycleID, Kind, ByRole),
  CONSTRAINT fk_h_cycle FOREIGN KEY (CycleID) REFERENCES AppraisalCycle(CycleID) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE AppraisalRequest (
  CycleID            INT PRIMARY KEY,
  NewDesignation     VARCHAR(150) NULL,
  DesignationComment TEXT NULL,
  NewTeam            VARCHAR(150) NULL,
  TeamComment        TEXT NULL,
  CONSTRAINT fk_req_cycle FOREIGN KEY (CycleID) REFERENCES AppraisalCycle(CycleID) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE AppraisalResponse (
  CycleID          INT PRIMARY KEY,
  Decision         ENUM('ACCEPT','REJECT') NOT NULL,
  PostponeMonths   TINYINT NULL,
  Reason           TEXT NULL,
  Expectations     TEXT NULL,
  Comment          TEXT NULL,
  HrApproverUserID INT NULL,
  HrStatus         ENUM('PENDING','APPROVED','RETURNED') NULL,
  HrComment        TEXT NULL,
  DecidedAt        DATETIME NOT NULL,
  CONSTRAINT fk_resp_cycle FOREIGN KEY (CycleID) REFERENCES AppraisalCycle(CycleID) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE AppraisalAudit (
  AuditID   BIGINT AUTO_INCREMENT PRIMARY KEY,
  CycleID   INT NOT NULL,
  ActorID   INT NULL,
  Action    VARCHAR(60) NOT NULL,
  Detail    JSON NULL,
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY ix_audit_cycle (CycleID)
) DEFAULT CHARSET=utf8mb4;

-- The Appraisal menu is a module like the others; every role may open it. What a person sees inside is decided by their part in each cycle.
UPDATE AMRole
SET RolePrivileges = JSON_SET(COALESCE(NULLIF(RolePrivileges, ''), '{}'), '$.appraisal', JSON_ARRAY('read'))
WHERE RoleID <> 1 AND JSON_EXTRACT(COALESCE(NULLIF(RolePrivileges, ''), '{}'), '$.appraisal') IS NULL;
