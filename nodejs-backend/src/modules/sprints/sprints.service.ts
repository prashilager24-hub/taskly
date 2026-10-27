import { pool } from '../../config/db';
import { AppError } from '../../utils/AppError';
import type mysql from 'mysql2/promise';

export async function getSprints(filters: { Status?: string; ProjectID?: string }) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (filters.Status) { conditions.push('ts.Status = ?'); params.push(filters.Status); }
  if (filters.ProjectID) { conditions.push('ts.ProjectID = ?'); params.push(filters.ProjectID); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT ts.*,
            COUNT(DISTINCT tsu.UserID) AS TeamSize,
            COUNT(DISTINCT st.StoryID) AS TotalStories,
            SUM(CASE WHEN st.Status = 'DONE' THEN 1 ELSE 0 END) AS DoneStories,
            SUM(st.StoryPoints) AS TotalPoints,
            SUM(CASE WHEN st.Status = 'DONE' THEN st.StoryPoints ELSE 0 END) AS CompletedPoints
     FROM TechSprint ts
     LEFT JOIN TechSprintUserMapping tsu ON tsu.SprintID = ts.SprintID
     LEFT JOIN TechStory st ON st.SprintID = ts.SprintID
     ${where}
     GROUP BY ts.SprintID
     ORDER BY ts.StartDate DESC`,
    params,
  );
  return rows;
}

export async function getSprintById(sprintId: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT ts.*,
            COUNT(DISTINCT tsu.UserID) AS TeamSize,
            SUM(st.StoryPoints) AS TotalPoints,
            SUM(CASE WHEN st.Status = 'DONE' THEN st.StoryPoints ELSE 0 END) AS CompletedPoints
     FROM TechSprint ts
     LEFT JOIN TechSprintUserMapping tsu ON tsu.SprintID = ts.SprintID
     LEFT JOIN TechStory st ON st.SprintID = ts.SprintID
     WHERE ts.SprintID = ?
     GROUP BY ts.SprintID`,
    [sprintId],
  );
  if (!rows.length) throw AppError.notFound('Sprint not found');
  return rows[0];
}

export async function createSprint(input: {
  SprintName: string; ProjectID: string; StartDate: string;
  EndDate: string; PlannedPoints: number;
}) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO TechSprint (SprintName, ProjectID, StartDate, EndDate, PlannedPoints, Status)
     VALUES (?, ?, ?, ?, ?, 'PLANNED')`,
    [input.SprintName, input.ProjectID, input.StartDate, input.EndDate, input.PlannedPoints],
  );
  return { SprintID: r.insertId, message: 'Sprint created' };
}

export async function updateSprintStatus(sprintId: number, status: string) {
  await pool.execute('UPDATE TechSprint SET Status = ? WHERE SprintID = ?', [status, sprintId]);
  return { message: 'Sprint status updated' };
}

export async function getSprintStories(sprintId: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT st.*, GROUP_CONCAT(DISTINCT u.UserName ORDER BY u.UserName SEPARATOR ', ') AS Assignees
     FROM TechStory st
     LEFT JOIN TechStoryAssignment tsa ON tsa.StoryID = st.StoryID
     LEFT JOIN Users u ON u.UserID = tsa.UserID
     WHERE st.SprintID = ?
     GROUP BY st.StoryID
     ORDER BY st.StoryKey`,
    [sprintId],
  );
  return rows;
}

export async function createStory(input: {
  SprintID: number; StoryKey: string; StoryPoints: number;
}) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    "INSERT INTO TechStory (SprintID, StoryKey, StoryPoints, Status) VALUES (?, ?, ?, 'TODO')",
    [input.SprintID, input.StoryKey, input.StoryPoints],
  );
  return { StoryID: r.insertId, message: 'Story created' };
}

export async function updateStoryStatus(storyId: number, status: string) {
  await pool.execute('UPDATE TechStory SET Status = ? WHERE StoryID = ?', [status, storyId]);
  return { message: 'Story status updated' };
}

export async function assignStory(input: { StoryID: number; UserID: number; PointsWorked: number }) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    'INSERT INTO TechStoryAssignment (StoryID, UserID, PointsWorked) VALUES (?, ?, ?)',
    [input.StoryID, input.UserID, input.PointsWorked],
  );
  return { AssignmentID: r.insertId, message: 'Story assigned' };
}

export async function getSprintTeam(sprintId: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT u.UserID, u.UserName, u.UserEmail, u.EmployeeID, r.RoleName
     FROM TechSprintUserMapping tsu
     JOIN Users u ON u.UserID = tsu.UserID
     LEFT JOIN AMRole r ON r.RoleID = u.RoleID
     WHERE tsu.SprintID = ?`,
    [sprintId],
  );
  return rows;
}

export async function addSprintMember(sprintId: number, userId: number) {
  await pool.execute(
    'INSERT IGNORE INTO TechSprintUserMapping (SprintID, UserID) VALUES (?, ?)',
    [sprintId, userId],
  );
  return { message: 'Member added to sprint' };
}

export async function getSprintEntries(sprintId: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT se.*, u.UserName, u.EmployeeID
     FROM sprint_entries se
     JOIN Users u ON u.UserID = se.UserID
     WHERE se.sprint_id = ?
     ORDER BY se.date`,
    [sprintId],
  );
  return rows;
}
