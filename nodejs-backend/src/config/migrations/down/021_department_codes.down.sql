-- Undo 021_department_codes.sql. Run by hand; the migration runner never reads this folder.
ALTER TABLE Department DROP INDEX uq_department_code;
ALTER TABLE Department DROP COLUMN IsDepartmentTeam;
ALTER TABLE Department DROP COLUMN Code;
ALTER TABLE PrimaryDepartment DROP INDEX uq_primarydepartment_code;
ALTER TABLE PrimaryDepartment DROP COLUMN Description;
ALTER TABLE PrimaryDepartment DROP COLUMN Code;
DELETE FROM SchemaMigration WHERE Name = '021_department_codes.sql';
