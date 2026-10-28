import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().min(1, 'username is required'),
  password: z.string().min(1, 'password is required'),
  keepSignedIn: z.boolean().optional(), // 7-day session instead of 1 day, kept across browser restarts
});

export const VerifyOtpSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^[0-9]{6}$/, 'Enter the 6-digit code'),
});

export const ResendOtpSchema = z.object({
  challengeId: z.string().uuid(),
});

export const ThemeSchema = z.object({
  theme: z.enum(['dark', 'light']),
});

export const CreateUserSchema = z.object({
  userEmail: z.string().email('Invalid email'),
  userName: z.string().min(2).max(100),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  roleID: z.number().int().positive(),
  secondaryRoleID: z.number().int().positive().optional().nullable(),
  employeeID: z.string().optional().nullable(),
  departmentID: z.number().int().positive().optional().nullable(),
  reportingManagerId: z.number().int().positive().optional().nullable(),
  elManagerId: z.number().int().positive().optional().nullable(),
  appraisalCycle: z.string().optional().nullable(),
  feedbackresolverteam: z.string().optional().nullable(),
});

export const UpdateUserSchema = z.object({
  userID: z.number().int().positive(),
  userEmail: z.string().email().optional(),
  userName: z.string().min(2).max(100).optional(),
  roleID: z.number().int().positive().optional(),
  secondaryRoleID: z.number().int().positive().optional().nullable(),
  employeeID: z.string().optional().nullable(),
  departmentID: z.number().int().positive().optional().nullable(),
  reportingManagerId: z.number().int().positive().optional().nullable(),
  elManagerId: z.number().int().positive().optional().nullable(),
  appraisalCycle: z.string().optional().nullable(),
  feedbackresolverteam: z.string().optional().nullable(),
});

export const UsersReadSchema = z.object({
  filter: z.string().optional(),
  searchText: z.string().optional(),
  departmentID: z.number().int().min(0).optional().nullable(), // 0 = all departments
  roleID: z.number().int().min(0).optional().nullable(),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email'),
});

export const ResetPasswordSchema = z.object({
  token: z.string().uuid('Invalid token'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export const UpdateUserStatusSchema = z.object({
  userIdList: z.array(z.number().int().positive()).min(1),
  userStatus: z.union([z.literal(0), z.literal(1)]),
});

export const ArchiveUsersSchema = z.object({
  userIdList: z.array(z.number().int().positive()).min(1),
  archive: z.boolean().optional().default(true),
});

export const SwitchUserSchema = z.object({
  userID: z.number().int().positive(),
});

export const AMRoleReadSchema = z.object({
  roleId: z.coerce.number().int().positive(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UsersReadInput = z.infer<typeof UsersReadSchema> & { page: number; size: number };
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type UpdateUserStatusInput = z.infer<typeof UpdateUserStatusSchema>;
export type ArchiveUsersInput = z.infer<typeof ArchiveUsersSchema>;
export type SwitchUserInput = z.infer<typeof SwitchUserSchema>;
