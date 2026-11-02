-- Appraisal: each quarter in the Associate's window has three things to fill in: comments, biggest achievements, biggest failures.
-- Achievements and failures already had columns; comments is new.
ALTER TABLE AppraisalQuarter ADD COLUMN Comments TEXT NULL;
