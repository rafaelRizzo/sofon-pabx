import { z } from 'zod'
import { timestamp, ok } from '../../../schemas/responses'
import { CompanySchema } from '../../companies/schemas/company.schema'

export const idParamSchema = z.object({
    id: z.cuid2(),
})

export const createUserSchema = z.object({
    name: z.string().min(1),
    username: z.email(),
    password: z.string().min(6),
    role: z.enum(['admin', 'reseller', 'user']).default('user'),
})

export const updateUserSchema = z.object({
    name: z.string().min(1).optional(),
    username: z.email().optional(),
    password: z.string().min(6).optional(),
    extensionId: z.cuid2().nullable().optional(),
})

export type IdParam = z.infer<typeof idParamSchema>
export type CreateUserInput = z.input<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>

export const UserSchema = z.object({
    id: z.string(),
    name: z.string(),
    username: z.string(),
    role: z.enum(['admin', 'reseller', 'user']),
    status: z.string(),
    extensionId: z.string().nullable(),
    webhookSlug: z.string(),
    createdBy: z.string().nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListUsersResponse = ok({ message: z.string(), users: z.array(UserSchema) })
export const GetUserResponse = ok({ message: z.string(), user: UserSchema })
export const GetUserCompaniesResponse = ok({ message: z.string(), companies: z.array(CompanySchema) })
export const CreateUserResponse = ok({ message: z.string(), userId: z.string() })
export const UpdateUserResponse = ok({ message: z.string() })
