ALTER TABLE JobApplications MODIFY COLUMN interviewStage ENUM('applied','screened','l1','l2','l3','offer','rejected') NOT NULL DEFAULT 'applied';
