-- Undo 020_user_types_and_roles.sql. Run by hand; the migration runner never reads this folder.
ALTER TABLE Users DROP COLUMN UserRole;
ALTER TABLE AMRole DROP COLUMN UserType;
DELETE FROM SchemaMigration WHERE Name = '020_user_types_and_roles.sql';
