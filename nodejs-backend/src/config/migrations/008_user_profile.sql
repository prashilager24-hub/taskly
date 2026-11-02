-- Position details shown on the user profile and captured when a user is created
ALTER TABLE Users
  ADD COLUMN Designation VARCHAR(120) NULL,
  ADD COLUMN JobLevel    VARCHAR(20)  NULL,
  ADD COLUMN Band        VARCHAR(20)  NULL;
