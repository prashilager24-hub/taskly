-- New user form: joining date (Users.DateOfJoining, already there), appraisal cycle (Users.AppraisalCycle: APRIL / OCTOBER)
-- and how often variable pay is paid out (new: QUARTERLY / HALF_YEARLY / ANNUAL).
ALTER TABLE Users ADD COLUMN VariableCycle VARCHAR(20) NULL;

-- The old form wrote QUARTERLY / HALF_YEARLY / ANNUAL into AppraisalCycle: that was the variable cycle, so move it there
UPDATE Users SET VariableCycle = AppraisalCycle, AppraisalCycle = NULL WHERE AppraisalCycle IN ('QUARTERLY', 'HALF_YEARLY', 'ANNUAL');
UPDATE Users SET AppraisalCycle = NULL WHERE AppraisalCycle = '';
