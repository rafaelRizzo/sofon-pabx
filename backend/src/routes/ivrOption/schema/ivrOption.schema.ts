import { z } from 'zod'
import { ApplicationsType, IVROptionType } from '../../../generated/prisma/enums'

const cuidSchema = z.cuid({ message: 'Formato de id inválido' })

export const createIVROptionSchema = {
    body: z.object({
        type: z.enum(IVROptionType),
        digit: z.string().optional(),
        minDigits: z.number().int().min(1).optional(),
        maxDigits: z.number().int().min(1).max(20).optional(), // limite do asterisk? verificar depois
        variableName: z.string().optional(),
        destinationApp: z.enum(ApplicationsType),
        destinationId: cuidSchema.optional(),
        ivrId: cuidSchema,
        companyId: cuidSchema
    })
}

export const updateIVROptionSchema = {
    params: z.object({
        id: cuidSchema
    }),
    body: z.object({
        type: z.enum(IVROptionType).optional(),
        digit: z.string().optional(),
        minDigits: z.number().int().min(1).optional(),
        maxDigits: z.number().int().min(1).max(20).optional(),
        variableName: z.string().optional(),
        destinationApp: z.enum(ApplicationsType).optional(),
        destinationId: cuidSchema.optional(),
        ivrId: cuidSchema.optional(),
        companyId: cuidSchema.optional()
    })
}

export const getIVROptionSchema = {
    params: z.object({
        id: cuidSchema
    })
}

export const deleteIVROptionSchema = {
    params: z.object({
        id: cuidSchema
    })
}

export type CreateIVROptionInput = z.infer<typeof createIVROptionSchema.body>
export type UpdateIVROptionInput = z.infer<typeof updateIVROptionSchema.body>
export type GetIVROptionParams = z.infer<typeof getIVROptionSchema.params>
export type DeleteIVROptionParams = z.infer<typeof deleteIVROptionSchema.params>
