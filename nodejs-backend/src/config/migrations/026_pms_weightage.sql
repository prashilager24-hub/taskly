-- People Hub PMS score (Model X, modules/pms/pmsScore.ts): Goal^w × Target^(1−w), w = 0.70 when Goal % > Target %,
-- else 0.50. An EL / manager (or Admin) may move up to 5% of weight between Goal and Target for one person for a
-- calendar year, with a justification. +0.050 = 5% from Target to Goal; -0.050 = 5% from Goal to Target.
CREATE TABLE IF NOT EXISTS PmsWeightage (
  UserID INT NOT NULL,
  PeriodYear SMALLINT NOT NULL,
  GoalShift DECIMAL(4,3) NOT NULL DEFAULT 0,
  Justification VARCHAR(500) NOT NULL,
  SetBy INT NOT NULL,
  SetAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (UserID, PeriodYear),
  CONSTRAINT chk_pms_goal_shift CHECK (GoalShift BETWEEN -0.050 AND 0.050)
);
