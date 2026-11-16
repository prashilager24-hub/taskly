-- Undo 024: restore ForgotPassword.status to its original boolean (tinyint) form
UPDATE ForgotPassword SET status = '1' WHERE status = 'PENDING';
UPDATE ForgotPassword SET status = '0' WHERE status IN ('USED', 'EXPIRED');
ALTER TABLE ForgotPassword MODIFY COLUMN status TINYINT(1) NULL;
