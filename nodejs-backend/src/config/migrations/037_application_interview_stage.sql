ALTER TABLE JobApplications ADD COLUMN interviewStage ENUM('applied','l1','l2','l3','offer','rejected') NOT NULL DEFAULT 'applied' AFTER status;
