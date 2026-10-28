-- Access management: department-wide access, per-user overrides, 2FA settings, change log

-- Extra access for everyone in a department (added on top of their role)
CREATE TABLE IF NOT EXISTS DepartmentAccess (
  DepartmentID INT        NOT NULL PRIMARY KEY,
  Privileges   LONGTEXT   NOT NULL,
  UpdatedBy    INT        NULL,
  UpdatedAt    DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Per-user exceptions: Grants add access, Denies take it away. Both are { module: [actions] } JSON.
CREATE TABLE IF NOT EXISTS UserAccess (
  UserID     INT        NOT NULL PRIMARY KEY,
  Grants     LONGTEXT   NULL,
  Denies     LONGTEXT   NULL,
  UpdatedBy  INT        NULL,
  UpdatedAt  DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Small key / value settings (two-factor default)
CREATE TABLE IF NOT EXISTS AppSetting (
  SettingKey   VARCHAR(64)  NOT NULL PRIMARY KEY,
  SettingValue VARCHAR(255) NOT NULL
);
INSERT IGNORE INTO AppSetting (SettingKey, SettingValue) VALUES ('twoFactorDefault', 'on');

-- Two-factor per user: NULL follows the default, 1 forces it on, 0 turns it off
ALTER TABLE Users ADD COLUMN TwoFactor TINYINT(1) NULL DEFAULT NULL;

-- Who changed what in Access Management
CREATE TABLE IF NOT EXISTS AccessLog (
  LogID      BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ActorID    INT          NULL,
  Target     VARCHAR(16)  NOT NULL,
  TargetID   INT          NULL,
  Summary    VARCHAR(500) NOT NULL,
  CreatedAt  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_accesslog_created (CreatedAt)
);
