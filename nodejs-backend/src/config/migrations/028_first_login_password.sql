-- First sign-in with a temporary password: MustChangePassword = 1 means the person signs in without the emailed code
-- and must set a new password before using People Hub; from then on two-factor sign-in works as usual.
-- Set for users created in Access Management and for anyone sent a People Hub invitation (which emails a new
-- temporary password). InvitedAt / InvitedBy record the last invitation.
ALTER TABLE Users
  ADD COLUMN MustChangePassword TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN InvitedAt DATETIME NULL,
  ADD COLUMN InvitedBy INT NULL;
