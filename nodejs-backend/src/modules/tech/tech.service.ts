import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';

export async function createTechSprint(input: {
  SprintName: string;
  ProjectID?: string;
  StartDate: string;
  EndDate: string;
  PlannedPoints?: number;
}) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO TechSprint (SprintName, ProjectID, StartDate, EndDate, PlannedPoints, Status)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
    [input.SprintName, input.ProjectID ?? null, input.StartDate,
     input.EndDate, input.PlannedPoints ?? 0],
  );
  const [[row]] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT * FROM TechSprint WHERE SprintID = ?', [r.insertId],
  );
  return row;
}

export async function addSprintUsers(sprintId: number, userIDs: number[]) {
  for (const uid of userIDs) {
    await pool.execute(
      'INSERT IGNORE INTO TechSprintUser (SprintID, UserID) VALUES (?, ?)',
      [sprintId, uid],
    );
  }
  return { message: `${userIDs.length} users added to sprint` };
}

export async function createStory(input: {
  SprintID: number;
  StoryKey: string;
  Title?: string;
  StoryPoints: number;
  AssignedTo?: number;
}) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO TechStory (SprintID, StoryKey, Title, StoryPoints, AssignedTo, Status)
     VALUES (?, ?, ?, ?, ?, 'TODO')`,
    [input.SprintID, input.StoryKey, input.Title ?? null,
     input.StoryPoints, input.AssignedTo ?? null],
  );
  const [[row]] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT * FROM TechStory WHERE StoryID = ?', [r.insertId],
  );
  return row;
}

export async function assignStory(storyId: number, userId: number, pointsWorked: number) {
  await pool.execute(
    'UPDATE TechStory SET AssignedTo = ?, PointsWorked = ? WHERE StoryID = ?',
    [userId, pointsWorked, storyId],
  );
  const [[row]] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT ts.*, u.UserName
     FROM TechStory ts LEFT JOIN Users u ON u.UserID = ts.AssignedTo
     WHERE ts.StoryID = ?`,
    [storyId],
  );
  return row;
}

export async function updateStoryStatus(storyId: number, status: string) {
  await pool.execute('UPDATE TechStory SET Status = ? WHERE StoryID = ?', [status, storyId]);
  const [[row]] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT * FROM TechStory WHERE StoryID = ?', [storyId],
  );
  return row;
}

export async function listTechSprints(filter: {
  Status?: string;
  ProjectID?: string;
}) {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  if (filter.Status) { conditions.push('Status = ?'); params.push(filter.Status); }
  if (filter.ProjectID) { conditions.push('ProjectID = ?'); params.push(filter.ProjectID); }
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT * FROM TechSprint WHERE ${conditions.join(' AND ')} ORDER BY StartDate DESC`,
    params,
  );
  return rows;
}

export async function listStories(filter: {
  SprintID?: number;
  AssignedTo?: number;
  Status?: string;
}) {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  if (filter.SprintID) { conditions.push('ts.SprintID = ?'); params.push(filter.SprintID); }
  if (filter.AssignedTo) { conditions.push('ts.AssignedTo = ?'); params.push(filter.AssignedTo); }
  if (filter.Status) { conditions.push('ts.Status = ?'); params.push(filter.Status); }
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT ts.*, u.UserName AS AssigneeName, sp.SprintName
     FROM TechStory ts
     LEFT JOIN Users u ON u.UserID = ts.AssignedTo
     LEFT JOIN TechSprint sp ON sp.SprintID = ts.SprintID
     WHERE ${conditions.join(' AND ')}
     ORDER BY ts.StoryKey`,
    params,
  );
  return rows;
}
