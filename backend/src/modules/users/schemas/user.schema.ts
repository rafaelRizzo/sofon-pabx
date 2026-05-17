import { z } from 'zod'
import { USER_ROLES, USER_STATUSES } from '../../../db/enums'
import { snowflakeId } from '../../../utils/validators/snowflake.validator'

export const createUserSchema = z.object({
    name: z.string().min(1).max(255).trim(),
    username: z.string().min(3).max(255).trim(),
    password: z.string().min(6).max(255),
    role: z.enum(USER_ROLES).optional(),
})

export const updateUserSchema = z.object({
    name: z.string().min(1).max(255).trim().optional(),
    username: z.string().min(3).max(255).trim().optional(),
    password: z.string().min(6).max(255).trim().optional(),
    status: z.enum(USER_STATUSES).optional(),
}).refine(
    (data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
})

export const idParamSchema = z.object({
    id: snowflakeId('user ID'),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type IdParamInput = z.infer<typeof idParamSchema>