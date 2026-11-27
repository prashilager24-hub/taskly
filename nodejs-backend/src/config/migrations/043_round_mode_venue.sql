ALTER TABLE InterviewRounds
  ADD COLUMN mode ENUM('online', 'in_person') DEFAULT 'online' AFTER interviewLink,
  ADD COLUMN venue VARCHAR(255) DEFAULT NULL AFTER mode,
  ADD COLUMN submitted_by VARCHAR(100) DEFAULT NULL AFTER managerFeedback,
  ADD COLUMN submitted_at DATETIME DEFAULT NULL AFTER submitted_by;
