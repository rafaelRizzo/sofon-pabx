import { z } from 'zod'
import { timestamp, ok } from '../../../schemas/responses'

export const idParamSchema = z.object({
    id: z.cuid2(),
})

export const companyQuerySchema = z.object({
    companyId: z.cuid2(),
})

export const companyIdParamSchema = z.object({
    id_company: z.cuid2(),
})

export const didStatusSchema = z.enum(['active', 'inactive', 'blocked'])

export const createDidSchema = z.object({
    number: z.string().regex(/^\d+$/, 'Only digits allowed'),
    companyId: z.cuid2(),
})

export const updateDidSchema = z.object({
    number: z.string().regex(/^\d+$/, 'Only digits allowed').optional(),
    status: didStatusSchema.optional(),
    companyId: z.cuid2().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required: number, status, companyId' })

export type IdParam = z.infer<typeof idParamSchema>
export type CompanyQuery = z.infer<typeof companyQuerySchema>
export type CreateDidInput = z.infer<typeof createDidSchema>
export type UpdateDidInput = z.infer<typeof updateDidSchema>

export const DidSchema = z.object({
    id: z.string(),
    number: z.string(),
    companyId: z.string(),
    status: didStatusSchema,
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListDidsResponse = ok({ message: z.string(), dids: z.array(DidSchema) })
export const GetDidResponse = ok({ message: z.string(), did: DidSchema })
export const CreateDidResponse = ok({ message: z.string(), didId: z.string() })
export const UpdateDidResponse = ok({ message: z.string() })
