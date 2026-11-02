-- New-joiner flag: set when a user is added, cleared when they submit the Onboarding Experience survey.
-- JoiningCycle is the April or October intake the person belongs to.
ALTER TABLE Users
  ADD COLUMN IsNewJoiner  TINYINT(1)  NOT NULL DEFAULT 0,
  ADD COLUMN JoiningCycle VARCHAR(10) NULL;

-- people who joined in the last 45 days (the previous rule) and have not answered a survey stay new
UPDATE Users u SET u.IsNewJoiner = 1, u.JoiningCycle = IF(MONTH(u.UserCreateTime) BETWEEN 4 AND 9, 'APRIL', 'OCTOBER')
WHERE u.UserCreateTime >= NOW() - INTERVAL 45 DAY
  AND NOT EXISTS (SELECT 1 FROM onboarding_surveys s WHERE s.employee_id = u.UserID AND s.status = 'SUBMITTED');
