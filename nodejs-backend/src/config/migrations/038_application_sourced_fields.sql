ALTER TABLE JobApplications ADD COLUMN sourcedBy VARCHAR(150) DEFAULT NULL AFTER internal_notes;
ALTER TABLE JobApplications ADD COLUMN relevantExperience VARCHAR(50) DEFAULT NULL AFTER total_experience;
