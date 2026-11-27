-- Backfill log entries for open roles that existed before logging was added
INSERT INTO TalentActivityLogs (entity_type, entity_id, action, details, actor, created_at)
SELECT
  'OPEN_ROLE',
  id,
  'Role created',
  CONCAT(title, ' · ', department, ' · ', location),
  COALESCE((SELECT UserName FROM Users WHERE UserID = created_by LIMIT 1), 'Admin'),
  created_at
FROM OpenRoles
WHERE id NOT IN (
  SELECT entity_id FROM TalentActivityLogs WHERE entity_type = 'OPEN_ROLE' AND action = 'Role created'
);

-- Backfill log entries for applications that existed before logging was added
INSERT INTO TalentActivityLogs (entity_type, entity_id, action, details, actor, created_at)
SELECT
  'APPLICATION',
  id,
  'Application submitted',
  CONCAT(role_title, IFNULL(CONCAT(' · ', current_company), ''), IFNULL(CONCAT(' · ', total_experience), '')),
  full_name,
  applied_at
FROM JobApplications
WHERE id NOT IN (
  SELECT entity_id FROM TalentActivityLogs WHERE entity_type = 'APPLICATION' AND action = 'Application submitted'
);
