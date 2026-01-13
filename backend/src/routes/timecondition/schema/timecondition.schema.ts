import { z } from 'zod'
import { ApplicationsType } from '../../../generated/prisma/enums'

const uuidSchema = z.cuid({ message: 'Formato de id inválido' })

export const createTimeConditionSchema = {
    body: z.object({
        name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome deve ter no máximo 100 caracteres'),
        companyId: uuidSchema,
        description: z.string().max(255).optional(),
        trueDestinationApp: z.enum(ApplicationsType),
        trueDestinationId: uuidSchema.optional(),
        falseDestinationApp: z.enum(ApplicationsType),
        falseDestinationId: uuidSchema.optional()
    })
}

export const updateTimeConditionSchema = {
    params: z.object({
        id: uuidSchema
    }),
    body: z.object({
        name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome deve ter no máximo 100 caracteres').optional(),
        companyId: uuidSchema.optional(),
        description: z.string().max(255).optional(),
        trueDestinationApp: z.enum(ApplicationsType).optional(),
        trueDestinationId: uuidSchema.optional(),
        falseDestinationApp: z.enum(ApplicationsType).optional(),
        falseDestinationId: uuidSchema.optional()
    })
}

export const getTimeConditionSchema = {
    params: z.object({
        id: uuidSchema
    })
}

export const deleteTimeConditionSchema = {
    params: z.object({
        id: uuidSchema
    })
}

export type CreateUserInput = z.infer<typeof createTimeConditionSchema.body>
export type UpdateUserInput = z.infer<typeof updateTimeConditionSchema.body>
export type GetUserParams = z.infer<typeof getTimeConditionSchema.params>
export type DeleteUserParams = z.infer<typeof deleteTimeConditionSchema.params>