UPDATE InterviewRounds SET status = 'Scheduled' WHERE status = 'Pending';
UPDATE InterviewRounds SET status = 'Selected'  WHERE status = 'Cleared';
