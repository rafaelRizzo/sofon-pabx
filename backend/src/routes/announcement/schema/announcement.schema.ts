import { z } from 'zod'
import { ApplicationsType } from '../../../generated/prisma/enums'

const uuidSchema = z.cuid({ message: 'Formato de id inválido' })

export const createAnnouncementSchema = {
    body: z.object({
        name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome deve ter no máximo 100 caracteres'),
        companyId: uuidSchema,
        audioId: uuidSchema,
        description: z.string().max(255).optional(),
        destinationApp: z.enum(ApplicationsType),
        destinationId: uuidSchema.optional()
    })
}

export const updateAnnouncementSchema = {
    params: z.object({
        id: uuidSchema
    }),
    body: z.object({
        name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome deve ter no máximo 100 caracteres').optional(),
        companyId: uuidSchema.optional(),
        audioId: uuidSchema.optional(),
        description: z.string().max(255).optional(),
        destinationApp: z.enum(ApplicationsType).optional(),
        destinationId: uuidSchema.optional()
    })
}

export const getAnnouncementSchema = {
    params: z.object({
        id: uuidSchema
    })
}

export const deleteAnnouncementSchema = {
    params: z.object({
        id: uuidSchema
    })
}

export type CreateUserInput = z.infer<typeof createAnnouncementSchema.body>
export type UpdateUserInput = z.infer<typeof updateAnnouncementSchema.body>
export type GetUserParams = z.infer<typeof getAnnouncementSchema.params>
export type DeleteUserParams = z.infer<typeof deleteAnnouncementSchema.params>