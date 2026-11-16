-- ForgotPassword.status was a legacy boolean (tinyint) from the old Java backend.
-- auth.service.ts treats it as a PENDING / USED / EXPIRED token lifecycle, which a
-- tinyint can't hold — every forgotPassword request failed with
-- "Truncated incorrect DECIMAL value: 'PENDING'".
ALTER TABLE ForgotPassword MODIFY COLUMN status VARCHAR(20) NULL;
UPDATE ForgotPassword SET status = 'PENDING' WHERE status = '1';
UPDATE ForgotPassword SET status = 'USED' WHERE status = '0' OR status IS NULL;
ALTER TABLE ForgotPassword MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
