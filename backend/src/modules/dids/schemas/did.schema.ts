import { z } from 'zod'

export const idParamSchema = z.object({
    id: z.cuid2(),
})

export const companyQuerySchema = z.object({
    companyId: z.cuid2(),
})

export const companyIdParamSchema = z.object({
    id_company: z.cuid2(),
})

export const createDidSchema = z.object({
    number: z.string().regex(/^\d+$/, 'Only digits allowed'),
    companyId: z.cuid2(),
})

export const updateDidSchema = z.object({
    number: z.string().regex(/^\d+$/, 'Only digits allowed').optional(),
})

export type IdParam = z.infer<typeof idParamSchema>
export type CompanyQuery = z.infer<typeof companyQuerySchema>
export type CreateDidInput = z.infer<typeof createDidSchema>
export type UpdateDidInput = z.infer<typeof updateDidSchema>
