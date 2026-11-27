ALTER TABLE JobApplications
  ADD COLUMN screening_notes TEXT DEFAULT NULL AFTER screenedBy,
  ADD COLUMN rejection_reason TEXT DEFAULT NULL AFTER screening_notes,
  ADD COLUMN rejected_at_stage VARCHAR(20) DEFAULT NULL AFTER rejection_reason,
  ADD COLUMN final_status VARCHAR(50) DEFAULT NULL AFTER rejected_at_stage,
  ADD COLUMN offered_ctc VARCHAR(50) DEFAULT NULL AFTER final_status,
  ADD COLUMN expected_doj DATE DEFAULT NULL AFTER offered_ctc;
