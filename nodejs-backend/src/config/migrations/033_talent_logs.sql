CREATE TABLE IF NOT EXISTS TalentActivityLogs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  entity_type ENUM('OPEN_ROLE','APPLICATION') NOT NULL,
  entity_id   INT          NOT NULL,
  action      VARCHAR(100) NOT NULL,
  details     TEXT         DEFAULT NULL,
  actor       VARCHAR(150) NOT NULL DEFAULT 'System',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
