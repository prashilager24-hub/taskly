-- Department Management: IDs for departments (TM-D01 …) and sub departments (TM-SD01 …), a description for departments,
-- and the hidden "team" sub department of a department created without sub departments (its people, tasks, targets
-- and goals live there). IDs are given once and never reused. Undo: down/021_department_codes.down.sql
ALTER TABLE PrimaryDepartment ADD COLUMN Code VARCHAR(12) NULL;
ALTER TABLE PrimaryDepartment ADD COLUMN Description VARCHAR(500) NULL;
ALTER TABLE PrimaryDepartment ADD UNIQUE KEY uq_primarydepartment_code (Code);
ALTER TABLE Department ADD COLUMN Code VARCHAR(12) NULL;
ALTER TABLE Department ADD COLUMN IsDepartmentTeam TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE Department ADD UNIQUE KEY uq_department_code (Code);

-- Departments in the order they were made
UPDATE PrimaryDepartment p
  JOIN (SELECT PrimaryDepartmentId, ROW_NUMBER() OVER (ORDER BY PrimaryDepartmentId) AS n FROM PrimaryDepartment) x ON x.PrimaryDepartmentId = p.PrimaryDepartmentId
   SET p.Code = CONCAT('TM-D', LPAD(x.n, 2, '0'))
 WHERE p.Code IS NULL;

-- Sub departments (not deleted) department by department, then by name; those under no department come last
UPDATE Department d
  JOIN (SELECT d2.DepartmentID,
               ROW_NUMBER() OVER (ORDER BY d2.PrimaryDepartmentId IS NULL, d2.PrimaryDepartmentId, d2.DepartmentName, d2.DepartmentID) AS n
          FROM Department d2 WHERE d2.IsDepartmentArchived = 0) x ON x.DepartmentID = d.DepartmentID
   SET d.Code = CONCAT('TM-SD', LPAD(x.n, 2, '0'))
 WHERE d.Code IS NULL;
