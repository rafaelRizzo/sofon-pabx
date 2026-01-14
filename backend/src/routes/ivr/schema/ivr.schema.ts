import { z } from 'zod'
import { ApplicationsType } from '../../../generated/prisma/enums'

const cuidSchema = z.cuid({ message: 'Formato de id inválido' })

export const createIVRSchema = {
    body: z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(255).optional(),
        audioId: cuidSchema.optional(),
        timeout: z.number().int().min(1).optional(),
        maxRetries: z.number().int().min(0).optional(),
        timeoutDestinationApp: z.nativeEnum(ApplicationsType),
        timeoutDestinationId: cuidSchema.optional(),
        invalidDestinationApp: z.nativeEnum(ApplicationsType),
        invalidDestinationId: cuidSchema.optional(),
        companyId: cuidSchema
    })
}

export const updateIVRSchema = {
    params: z.object({
        id: cuidSchema
    }),
    body: z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(255).optional(),
        audioId: cuidSchema.optional(),
        timeout: z.number().int().min(1).optional(),
        maxRetries: z.number().int().min(0).optional(),
        timeoutDestinationApp: z.nativeEnum(ApplicationsType).optional(),
        timeoutDestinationId: cuidSchema.optional(),
        invalidDestinationApp: z.nativeEnum(ApplicationsType).optional(),
        invalidDestinationId: cuidSchema.optional()
    })
}

export const getIVRSchema = {
    params: z.object({
        id: cuidSchema
    })
}

export const deleteIVRSchema = {
    params: z.object({
        id: cuidSchema
    })
}

export type CreateIVRInput = z.infer<typeof createIVRSchema.body>
export type UpdateIVRInput = z.infer<typeof updateIVRSchema.body>
export type GetIVRParams = z.infer<typeof getIVRSchema.params>
export type DeleteIVRParams = z.infer<typeof deleteIVRSchema.params>
