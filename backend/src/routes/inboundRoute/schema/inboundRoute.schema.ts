import { z } from 'zod'
import { ApplicationsType } from '../../../generated/prisma/enums'

const uuidSchema = z.cuid({ message: 'Formato de id inválido' })

export const createInboundRouteSchema = {
    body: z.object({
        name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome deve ter no máximo 100 caracteres'),
        companyId: uuidSchema,
        numberReceived: z.string().min(1, 'Número recebido é obrigatório').max(100, 'Número recebido deve ter no máximo 100 caracteres'),
        description: z.string().max(255).optional(),
        destinationApp: z.enum(ApplicationsType),
        destinationId: uuidSchema
    })
}

export const updateInboundRouteSchema = {
    params: z.object({
        id: uuidSchema
    }),
    body: z.object({
        name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome deve ter no máximo 100 caracteres'),
        companyId: uuidSchema,
        numberReceived: z.string().min(1, 'Número recebido é obrigatório').max(100, 'Número recebido deve ter no máximo 100 caracteres'),
        destinationApp: z.enum(ApplicationsType),
        destinationId: uuidSchema,
        description: z.string().max(255).optional(),
    })
}

export const getInboundRouteSchema = {
    params: z.object({
        id: uuidSchema
    })
}

export const deleteInboundRouteSchema = {
    params: z.object({
        id: uuidSchema
    })
}

export type CreateUserInput = z.infer<typeof createInboundRouteSchema.body>
export type UpdateUserInput = z.infer<typeof updateInboundRouteSchema.body>
export type GetUserParams = z.infer<typeof getInboundRouteSchema.params>
export type DeleteUserParams = z.infer<typeof deleteInboundRouteSchema.params>