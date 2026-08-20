import { z } from 'zod'
import { timestamp, ok } from '../../../schemas/responses'
import { CompanySchema } from '../../companies/schemas/company.schema'
import { PERMISSION_KEYS } from '../../../utils/auth/permissions'

export const idParamSchema = z.object({
    id: z.cuid2(),
})

// Relevante só para role="user"; ignorado (mas aceito) para admin/reseller, que têm acesso irrestrito
export const permissionsSchema = z.array(z.enum(PERMISSION_KEYS)).default([])

// Todo usuário precisa estar vinculado a pelo menos 1 empresa: sem isso, req.scope.companyIds
// fica [] e o usuário não enxerga nada (nenhum recurso escopado por empresa)
export const createUserSchema = z.object({
    name: z.string().min(1),
    username: z.email(),
    password: z.string().min(6),
    role: z.enum(['admin', 'reseller', 'user']).default('user'),
    permissions: permissionsSchema,
    companyIds: z.array(z.cuid2()).min(1, 'Select at least one company'),
    // vincula direto ao ramal na criação (ver Extension.webrtc / softphone) — opcional
    extensionId: z.cuid2().nullable().optional(),
})

export const updateUserSchema = z.object({
    name: z.string().min(1).optional(),
    username: z.email().optional(),
    password: z.string().min(6).optional(),
    extensionId: z.cuid2().nullable().optional(),
    permissions: permissionsSchema.optional(),
    // omitido = mantém vínculos atuais; se enviado, substitui a lista completa (nunca vazio)
    companyIds: z.array(z.cuid2()).min(1, 'Select at least one company').optional(),
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
    permissions: z.array(z.string()),
    extensionId: z.string().nullable(),
    webhookSlug: z.string(),
    createdBy: z.string().nullable(),
    companies: z.array(z.object({ id: z.string(), name: z.string() })),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListUsersResponse = ok({ message: z.string(), users: z.array(UserSchema) })
export const GetUserResponse = ok({ message: z.string(), user: UserSchema })
export const GetUserCompaniesResponse = ok({ message: z.string(), companies: z.array(CompanySchema) })
export const CreateUserResponse = ok({ message: z.string(), userId: z.string() })
export const UpdateUserResponse = ok({ message: z.string() })
