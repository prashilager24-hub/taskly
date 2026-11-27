CREATE TABLE IF NOT EXISTS OpenRoles (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  title           VARCHAR(200)  NOT NULL,
  department      VARCHAR(150)  NOT NULL,
  location        VARCHAR(100)  NOT NULL,
  openings        INT           NOT NULL DEFAULT 1,
  experience      VARCHAR(50)   DEFAULT NULL,
  employment_type VARCHAR(50)   NOT NULL DEFAULT 'Full Time',
  description     TEXT          DEFAULT NULL,
  hiring_manager  VARCHAR(150)  DEFAULT NULL,
  status          ENUM('OPEN','ON_HOLD','CLOSED') NOT NULL DEFAULT 'OPEN',
  created_by      INT           DEFAULT NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES Users(UserID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
