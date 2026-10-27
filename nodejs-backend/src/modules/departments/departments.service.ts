import { pool } from '../../config/db';
import { AppError } from '../../utils/AppError';
import type {
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
  AddDepartmentUserSchema,
  RemoveDepartmentUserSchema,
} from './departments.schema';
import type { z } from 'zod';

type CreateDepartmentInput = z.infer<typeof CreateDepartmentSchema>;
type UpdateDepartmentInput = z.infer<typeof UpdateDepartmentSchema>;
type AddDepartmentUserInput = z.infer<typeof AddDepartmentUserSchema>;
type RemoveDepartmentUserInput = z.infer<typeof RemoveDepartmentUserSchema>;

import type mysql from 'mysql2/promise';

export async function getAllDepartments() {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT d.DepartmentID, d.DepartmentName, d.ExecutiveLeaderID,
            d.FunctionalLeaderID, d.PrimaryDepartmentId,
            pd.PrimaryDepartmentName, pd.Type,
            u.UserName AS ExecutiveLeaderName
     FROM Department d
     LEFT JOIN PrimaryDepartment pd ON pd.PrimaryDepartmentId = d.PrimaryDepartmentId
     LEFT JOIN Users u ON u.UserID = d.ExecutiveLeaderID
     ORDER BY d.DepartmentName`,
  );
  return rows;
}

export async function getDepartmentById(id: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT d.*, pd.PrimaryDepartmentName, pd.Type
     FROM Department d
     LEFT JOIN PrimaryDepartment pd ON pd.PrimaryDepartmentId = d.PrimaryDepartmentId
     WHERE d.DepartmentID = ?`,
    [id],
  );
  if (!rows.length) throw AppError.notFound('Department not found');
  return rows[0];
}

export async function createDepartment(input: CreateDepartmentInput) {
  const [result] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO Department (DepartmentName, ExecutiveLeaderID, FunctionalLeaderID, PrimaryDepartmentId)
     VALUES (?, ?, ?, ?)`,
    [input.DepartmentName, input.ExecutiveLeaderID, input.FunctionalLeaderID ?? null, input.PrimaryDepartmentId],
  );
  return { DepartmentID: result.insertId, message: 'Department created' };
}

export async function updateDepartment(input: UpdateDepartmentInput) {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.DepartmentName !== undefined) { fields.push('DepartmentName = ?'); values.push(input.DepartmentName); }
  if (input.ExecutiveLeaderID !== undefined) { fields.push('ExecutiveLeaderID = ?'); values.push(input.ExecutiveLeaderID); }
  if (input.FunctionalLeaderID !== undefined) { fields.push('FunctionalLeaderID = ?'); values.push(input.FunctionalLeaderID); }
  if (input.PrimaryDepartmentId !== undefined) { fields.push('PrimaryDepartmentId = ?'); values.push(input.PrimaryDepartmentId); }

  if (!fields.length) throw AppError.badRequest('No fields to update');
  values.push(input.DepartmentID);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await pool.execute(`UPDATE Department SET ${fields.join(', ')} WHERE DepartmentID = ?`, values as any);
  return { message: 'Department updated' };
}

export async function getDepartmentUsers(departmentId: number) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT u.UserID, u.UserName, u.UserEmail, u.EmployeeID, u.UserStatus,
            r.RoleName, du.DepartmentID
     FROM DepartmentUser du
     JOIN Users u ON u.UserID = du.UserID
     LEFT JOIN AMRole r ON r.RoleID = u.RoleID
     WHERE du.DepartmentID = ? AND u.IsUserArchived = 0
     ORDER BY u.UserName`,
    [departmentId],
  );
  return rows;
}

export async function addUserToDepartment(input: AddDepartmentUserInput) {
  await pool.execute(
    'INSERT IGNORE INTO DepartmentUser (DepartmentID, UserID) VALUES (?, ?)',
    [input.DepartmentID, input.UserID],
  );
  return { message: 'User added to department' };
}

export async function removeUserFromDepartment(input: RemoveDepartmentUserInput) {
  await pool.execute(
    'DELETE FROM DepartmentUser WHERE DepartmentID = ? AND UserID = ?',
    [input.DepartmentID, input.UserID],
  );
  return { message: 'User removed from department' };
}

export async function getPrimaryDepartments() {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT * FROM PrimaryDepartment WHERE IsActive = 1 ORDER BY PrimaryDepartmentName',
  );
  return rows;
}
