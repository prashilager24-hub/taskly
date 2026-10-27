/**
 * Seed script — populates the `utilization` database with realistic dummy data.
 * Run with: npm run db:seed
 *
 * Safe to run multiple times (uses INSERT IGNORE or ON DUPLICATE KEY UPDATE).
 */
import bcrypt from 'bcryptjs';
import { pool } from './db';

async function seed() {
  console.log('🌱  Seeding database...');

  // ── Roles ──────────────────────────────────────────────────────────────────
  await pool.execute(`
    INSERT IGNORE INTO AMRole (RoleID, RoleName, RolePrivileges, RoleStatus, IsRoleArchived)
    VALUES
      (1, 'Super Admin', '["*"]', 'ACTIVE', 0),
      (2, 'Manager',     '["read","write","manage_team"]', 'ACTIVE', 0),
      (3, 'Employee',    '["read","write_own"]', 'ACTIVE', 0),
      (4, 'HR',          '["read","hr_manage"]', 'ACTIVE', 0),
      (5, 'Sales',       '["read","sales_manage"]', 'ACTIVE', 0)
  `);
  console.log('  ✓ Roles');

  // ── Primary Departments ────────────────────────────────────────────────────
  await pool.execute(`
    INSERT IGNORE INTO PrimaryDepartment
      (PrimaryDepartmentId, PrimaryDepartmentName, Type, IsActive, TargetCriteria, GoalCriteria)
    VALUES
      (1, 'Engineering',  'TECH', 1, '{}', '{}'),
      (2, 'Sales',        'SALES', 1, '{}', '{}'),
      (3, 'HR',           'HR', 1, '{}', '{}'),
      (4, 'Operations',   'OPS', 1, '{}', '{}')
  `);
  console.log('  ✓ Primary Departments');

  // ── Users (admin + sample employees) ──────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@123', 12);
  const empHash   = await bcrypt.hash('Employee@123', 12);

  await pool.execute(`
    INSERT INTO Users
      (UserEmail, UserName, UserPassword, RoleID, UserStatus, IsUserArchived, EmployeeID)
    VALUES
      ('admin@tapmind.com',   'admin',          ?, 1, 'ACTIVE', 0, 'EMP001'),
      ('manager@tapmind.com', 'john_manager',   ?, 2, 'ACTIVE', 0, 'EMP002'),
      ('emp1@tapmind.com',    'priya_sharma',   ?, 3, 'ACTIVE', 0, 'EMP003'),
      ('emp2@tapmind.com',    'rahul_verma',    ?, 3, 'ACTIVE', 0, 'EMP004'),
      ('emp3@tapmind.com',    'anjali_nair',    ?, 3, 'ACTIVE', 0, 'EMP005'),
      ('hr@tapmind.com',      'meera_hr',       ?, 4, 'ACTIVE', 0, 'EMP006'),
      ('sales1@tapmind.com',  'arjun_sales',    ?, 5, 'ACTIVE', 0, 'EMP007')
    ON DUPLICATE KEY UPDATE UserPassword = VALUES(UserPassword)
  `, [adminHash, empHash, empHash, empHash, empHash, empHash, empHash]);
  console.log('  ✓ Users (admin@tapmind.com / Admin@123, emp1@tapmind.com / Employee@123)');

  // ── Departments ────────────────────────────────────────────────────────────
  await pool.execute(`
    INSERT IGNORE INTO Department
      (DepartmentID, DepartmentName, ExecutiveLeaderID, FunctionalLeaderID, PrimaryDepartmentId)
    VALUES
      (1, 'Backend Engineering', 1, 2, 1),
      (2, 'Frontend Engineering', 1, 2, 1),
      (3, 'Sales Team',           1, 7, 2),
      (4, 'Human Resources',      1, 6, 3)
  `);
  console.log('  ✓ Departments');

  // ── DepartmentUser mappings ────────────────────────────────────────────────
  await pool.execute(`
    INSERT IGNORE INTO DepartmentUser (DepartmentID, UserID) VALUES
      (1, 3), (1, 4),
      (2, 5),
      (3, 7),
      (4, 6)
  `);
  console.log('  ✓ DepartmentUser mappings');

  // ── Job Positions ──────────────────────────────────────────────────────────
  await pool.execute(`
    INSERT IGNORE INTO JobPositions (PositionID, PositionName, JD_Details, Status) VALUES
      (1, 'Senior Backend Developer', 'Node.js, MySQL, AWS experience required', 'OPEN'),
      (2, 'React Developer', 'React 18+, TypeScript, TanStack Query', 'OPEN'),
      (3, 'Sales Executive', 'B2B SaaS sales experience', 'OPEN')
  `);
  console.log('  ✓ Job Positions');

  // ── Department Tasks ───────────────────────────────────────────────────────
  await pool.execute(`
    INSERT IGNORE INTO DepartmentTask
      (TaskID, DepartmentID, TaskName, StandardTimeMins, Frequency, IsForTarget)
    VALUES
      (1, 1, 'Code Review',        60,  'DAILY', 0),
      (2, 1, 'Feature Development',480, 'DAILY', 1),
      (3, 1, 'Bug Fix',            120, 'DAILY', 1),
      (4, 2, 'UI Component Build', 480, 'DAILY', 1),
      (5, 3, 'Client Calls',       30,  'DAILY', 1),
      (6, 4, 'Onboarding',         120, 'WEEKLY', 0)
  `);
  console.log('  ✓ Department Tasks');

  // ── Department Goals ───────────────────────────────────────────────────────
  await pool.execute(`
    INSERT IGNORE INTO DepartmentGoal
      (GoalID, DepartmentID, GoalName, GoalMetric, Frequency, IsDynamic, approvedByEL)
    VALUES
      (1, 1, 'Sprint Completion Rate', 'PERCENTAGE', 'SPRINT', 0, 1),
      (2, 2, 'UI Delivery Speed',      'PERCENTAGE', 'WEEKLY', 0, 1),
      (3, 3, 'Deals Closed',           'COUNT',      'MONTHLY', 0, 1)
  `);
  console.log('  ✓ Department Goals');

  // ── Tech Sprint ────────────────────────────────────────────────────────────
  await pool.execute(`
    INSERT IGNORE INTO TechSprint
      (SprintID, SprintName, ProjectID, StartDate, EndDate, PlannedPoints, Status)
    VALUES
      (1, 'Sprint 1 - Auth Migration',   'TASKLY-NODE', '2026-10-01', '2026-10-14', 40, 'COMPLETED'),
      (2, 'Sprint 2 - Core APIs',        'TASKLY-NODE', '2026-10-15', '2026-10-28', 50, 'ACTIVE'),
      (3, 'Sprint 3 - Frontend Polish',  'TASKLY-NODE', '2026-10-29', '2026-11-11', 30, 'PLANNED')
  `);
  console.log('  ✓ Tech Sprints');

  // ── Tech Stories ──────────────────────────────────────────────────────────
  await pool.execute(`
    INSERT IGNORE INTO TechStory
      (StoryID, SprintID, StoryKey, StoryPoints, Status)
    VALUES
      (1,  1, 'TNODE-1', 5,  'DONE'),
      (2,  1, 'TNODE-2', 8,  'DONE'),
      (3,  1, 'TNODE-3', 13, 'DONE'),
      (4,  2, 'TNODE-4', 8,  'IN_PROGRESS'),
      (5,  2, 'TNODE-5', 5,  'TODO'),
      (6,  2, 'TNODE-6', 13, 'TODO'),
      (7,  3, 'TNODE-7', 5,  'TODO'),
      (8,  3, 'TNODE-8', 8,  'TODO')
  `);
  console.log('  ✓ Tech Stories');

  // ── UserWorkData sample ────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  await pool.execute(`
    INSERT IGNORE INTO UserWorkData
      (TaskID, UserID, WorkDate, AllocatedTime, TimeTakenToWork, DepartmentID, AchivedUnits)
    VALUES
      (2, 3, ?, 480, 450, 1, 1),
      (3, 3, ?, 120, 100, 1, 2),
      (2, 4, ?, 480, 480, 1, 1),
      (4, 5, ?, 480, 460, 2, 1),
      (5, 7, ?, 240, 200, 3, 8)
  `, [today, today, today, today, today]);
  console.log('  ✓ UserWorkData (today)');

  // ── UserGoalData sample ────────────────────────────────────────────────────
  await pool.execute(`
    INSERT IGNORE INTO UserGoalData
      (WorkDate, UserID, DepartmentID, GoalID, FixedGoal, AchievedGoal)
    VALUES
      (?, 3, 1, 1, 100, 90),
      (?, 4, 1, 1, 100, 95),
      (?, 5, 2, 2, 100, 85)
  `, [today, today, today]);
  console.log('  ✓ UserGoalData (today)');

  console.log('\n🎉  Seeding complete!\n');
  console.log('Test credentials:');
  console.log('  Admin:    admin@tapmind.com / Admin@123');
  console.log('  Employee: emp1@tapmind.com  / Employee@123');
  console.log('  Manager:  manager@tapmind.com / Employee@123\n');

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
