import { z } from 'zod';

export const CreateDepartmentSchema = z.object({
  DepartmentName: z.string().min(2).max(100),
  ExecutiveLeaderID: z.number().int().positive(),
  FunctionalLeaderID: z.number().int().positive().optional().nullable(),
  PrimaryDepartmentId: z.number().int().positive(),
});

export const UpdateDepartmentSchema = z.object({
  DepartmentID: z.number().int().positive(),
  DepartmentName: z.string().min(2).max(100).optional(),
  ExecutiveLeaderID: z.number().int().positive().optional(),
  FunctionalLeaderID: z.number().int().positive().optional().nullable(),
  PrimaryDepartmentId: z.number().int().positive().optional(),
});

export const DepartmentUsersSchema = z.object({
  DepartmentID: z.number().int().positive(),
});

export const AddDepartmentUserSchema = z.object({
  DepartmentID: z.number().int().positive(),
  UserID: z.number().int().positive(),
});

export const RemoveDepartmentUserSchema = z.object({
  DepartmentID: z.number().int().positive(),
  UserID: z.number().int().positive(),
});
