-- Survey templates: HR can add Onboarding Experience and Employee Engagement surveys with their own questions.
-- A survey keeps a copy of the questions it was sent with (Questions), so editing a template later never
-- changes how earlier answers read.

CREATE TABLE IF NOT EXISTS SurveyTemplate (
  TemplateID  INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  Kind        ENUM('ONBOARDING','ENGAGEMENT') NOT NULL,
  Name        VARCHAR(150) NOT NULL,
  Description VARCHAR(300) NULL,
  IsActive    TINYINT(1)   NOT NULL DEFAULT 1,
  IsDefault   TINYINT(1)   NOT NULL DEFAULT 0,
  CreatedBy   INT          NULL,
  CreatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_template_kind (Kind, IsActive)
);

-- RATING: scored 1-10. MONTHLY (engagement only): rated once for each month of the quarter. TEXT: open answer.
CREATE TABLE IF NOT EXISTS SurveyTemplateQuestion (
  QuestionID INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  TemplateID INT          NOT NULL,
  Position   INT          NOT NULL,
  Section    VARCHAR(150) NULL,
  Text       VARCHAR(500) NOT NULL,
  ShortLabel VARCHAR(60)  NULL,
  Kind       ENUM('RATING','MONTHLY','TEXT') NOT NULL DEFAULT 'RATING',
  KEY idx_question_template (TemplateID, Position)
);

ALTER TABLE onboarding_surveys ADD COLUMN TemplateID INT NULL, ADD COLUMN Questions LONGTEXT NULL;
ALTER TABLE engagement_surveys ADD COLUMN TemplateID INT NULL, ADD COLUMN Questions LONGTEXT NULL;

-- The two surveys in use today become the default templates
INSERT INTO SurveyTemplate (TemplateID, Kind, Name, Description, IsActive, IsDefault)
VALUES (1, 'ONBOARDING', 'Onboarding Experience Survey', '7 ratings and 1 open question for new joiners', 1, 1),
       (2, 'ENGAGEMENT', 'Employee Engagement Survey', 'Monthly activity rating, 2 ratings and 1 open question', 1, 1);

INSERT INTO SurveyTemplateQuestion (TemplateID, Position, Section, Text, ShortLabel, Kind) VALUES
 (1, 1, 'Overall Onboarding Experience', 'How would you rate your overall onboarding experience?', 'Overall experience', 'RATING'),
 (1, 2, 'Overall Onboarding Experience', 'How smooth and well-coordinated was your onboarding process?', 'Smooth & coordinated', 'RATING'),
 (1, 3, 'Overall Onboarding Experience', 'How clear and helpful was the information provided during your induction?', 'Induction clarity', 'RATING'),
 (1, 4, 'Overall Onboarding Experience', 'How well did the onboarding process help you feel prepared and comfortable to begin your role?', 'Felt prepared', 'RATING'),
 (1, 5, 'HR Team Experience', 'How would you rate your overall interaction with the HR team during onboarding?', 'HR interaction', 'RATING'),
 (1, 6, 'HR Team Experience', 'How approachable and responsive was the HR team throughout your onboarding?', 'HR approachability', 'RATING'),
 (1, 7, 'HR Team Experience', 'How effectively did the HR team address your questions and support your joining needs?', 'HR addressed needs', 'RATING'),
 (1, 8, NULL, 'What is one thing we could improve to make the onboarding experience better?', NULL, 'TEXT'),
 (2, 1, NULL, 'How would you rate the HR engagement activities conducted during each month of this quarter?', 'Activities', 'MONTHLY'),
 (2, 2, NULL, 'How would you rate HR''s planning and execution of the engagement activities this quarter?', 'Planning & execution', 'RATING'),
 (2, 3, NULL, 'How approachable and responsive was the HR team during these activities?', 'HR approachability', 'RATING'),
 (2, 4, NULL, 'What is one thing we could improve in our engagement activities?', NULL, 'TEXT');

-- Default access: the HR role (4) can manage both kinds of template. Everyone on the HR or L&D team gets the
-- same by default whatever their role (see HR_TEAM_DEFAULTS in access.service.ts). Super Admin has everything.
UPDATE AMRole SET RolePrivileges = JSON_SET(RolePrivileges,
    '$.hr_onb_templates', JSON_ARRAY('read','create','update','delete'),
    '$.hr_eng_templates', JSON_ARRAY('read','create','update','delete'))
WHERE RoleID = 4 AND RolePrivileges IS NOT NULL AND JSON_VALID(RolePrivileges) AND JSON_TYPE(RolePrivileges) = 'OBJECT';
