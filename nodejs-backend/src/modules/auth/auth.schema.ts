import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().min(1, 'username is required'),
  password: z.string().min(1, 'password is required'),
});

export const CreateUserSchema = z.object({
  UserEmail: z.string().email('Invalid email'),
  UserName: z.string().min(2).max(100),
  UserPassword: z.string().min(6, 'Password must be at least 6 characters'),
  RoleID: z.number().int().positive(),
  SecondaryRoleID: z.number().int().positive().optional().nullable(),
  EmployeeID: z.string().optional().nullable(),
  ReportingManagerID: z.number().int().positive().optional().nullable(),
  ELManagerID: z.number().int().positive().optional().nullable(),
  AppraisalCycle: z.string().optional().nullable(),
});

export const UpdateUserSchema = z.object({
  UserID: z.number().int().positive(),
  UserEmail: z.string().email().optional(),
  UserName: z.string().min(2).max(100).optional(),
  RoleID: z.number().int().positive().optional(),
  SecondaryRoleID: z.number().int().positive().optional().nullable(),
  EmployeeID: z.string().optional().nullable(),
  ReportingManagerID: z.number().int().positive().optional().nullable(),
  ELManagerID: z.number().int().positive().optional().nullable(),
  AppraisalCycle: z.string().optional().nullable(),
});

export const UsersReadSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
  search: z.string().optional(),
  RoleID: z.number().int().positive().optional(),
  IsUserArchived: z.boolean().optional(),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email'),
});

export const ResetPasswordSchema = z.object({
  token: z.string().uuid('Invalid token'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export const UpdateUserStatusSchema = z.object({
  UserID: z.number().int().positive(),
  UserStatus: z.enum(['ACTIVE', 'INACTIVE']),
});

export const ArchiveUsersSchema = z.object({
  userIds: z.array(z.number().int().positive()).min(1),
  archive: z.boolean(),
});

export const SwitchUserSchema = z.object({
  targetUserID: z.number().int().positive(),
});

export const AMRoleReadSchema = z.object({
  roleId: z.coerce.number().int().positive(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UsersReadInput = z.infer<typeof UsersReadSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type UpdateUserStatusInput = z.infer<typeof UpdateUserStatusSchema>;
export type ArchiveUsersInput = z.infer<typeof ArchiveUsersSchema>;
export type SwitchUserInput = z.infer<typeof SwitchUserSchema>;
