-- Sign-in security (requirements AUTH-01 – AUTH-11)

-- One row per signed-in session. A new sign-in revokes the user's other active sessions
-- (one device per account); every API request checks its session is still active.
CREATE TABLE IF NOT EXISTS UserSession (
  SessionID     CHAR(36)     NOT NULL PRIMARY KEY,
  UserID        INT          NOT NULL,
  KeepSignedIn  TINYINT(1)   NOT NULL DEFAULT 0,
  UserAgent     VARCHAR(255) NULL,
  IPAddress     VARCHAR(64)  NULL,
  CreatedAt     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ExpiresAt     DATETIME     NOT NULL,
  RevokedAt     DATETIME     NULL,
  RevokedReason VARCHAR(32)  NULL,
  INDEX idx_session_user_active (UserID, RevokedAt),
  CONSTRAINT fk_session_user FOREIGN KEY (UserID) REFERENCES Users (UserID) ON DELETE CASCADE
);

-- Emailed one-time codes. Only an HMAC of the code is stored.
CREATE TABLE IF NOT EXISTS LoginChallenge (
  ChallengeID  CHAR(36)    NOT NULL PRIMARY KEY,
  UserID       INT         NOT NULL,
  CodeHash     CHAR(64)    NOT NULL,
  KeepSignedIn TINYINT(1)  NOT NULL DEFAULT 0,
  Attempts     INT         NOT NULL DEFAULT 0,
  Resends      INT         NOT NULL DEFAULT 0,
  LastSentAt   DATETIME    NOT NULL,
  ExpiresAt    DATETIME    NOT NULL,
  ConsumedAt   DATETIME    NULL,
  CreatedAt    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_challenge_user (UserID),
  CONSTRAINT fk_challenge_user FOREIGN KEY (UserID) REFERENCES Users (UserID) ON DELETE CASCADE
);

-- Sign-in audit trail (AUTH-10): password / code results, lockouts, sign-outs, replaced sessions
CREATE TABLE IF NOT EXISTS AuthEvent (
  EventID   BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  UserID    INT          NULL,
  Email     VARCHAR(255) NULL,
  Event     VARCHAR(32)  NOT NULL,
  SessionID CHAR(36)     NULL,
  IPAddress VARCHAR(64)  NULL,
  UserAgent VARCHAR(255) NULL,
  CreatedAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_authevent_user_time (UserID, CreatedAt)
);

-- Dark / Light choice, applied on every sign-in until the user changes it (AUTH-11, THEME-02)
ALTER TABLE Users ADD COLUMN ThemePreference VARCHAR(10) NULL;
