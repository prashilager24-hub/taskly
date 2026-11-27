CREATE TABLE IF NOT EXISTS InterviewRounds (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  applicationId INT NOT NULL,
  roundNumber   TINYINT NOT NULL DEFAULT 1,
  interviewDate VARCHAR(50),
  interviewerName VARCHAR(150),
  interviewLink VARCHAR(500),
  status        ENUM('Pending','Cleared','Rejected','On Hold') DEFAULT 'Pending',
  feedback      TEXT,
  createdAt     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (applicationId) REFERENCES JobApplications(id) ON DELETE CASCADE,
  UNIQUE KEY uq_app_round (applicationId, roundNumber)
);
