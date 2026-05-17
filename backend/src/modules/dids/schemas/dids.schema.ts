import { z } from 'zod'

export const createDidSchema = z.object({
    company_id: z.string().regex(/^\d+$/, 'Invalid company ID').transform(v => BigInt(v)),
    number: z.string().min(1, 'DID number is required').max(20),
    description: z.string().max(255).optional(),
})

export const updateDidSchema = z.object({
    number: z.string().min(1).max(20).optional(),
    description: z.string().max(255).optional(),
    status: z.enum(['active', 'inactive']).optional(),
})

export const idParamSchema = z.object({
    id: z.string().regex(/^\d+$/, 'Invalid DID ID').transform(v => BigInt(v)),
})

export const companyIdParamSchema = z.object({
    company_id: z.string().regex(/^\d+$/, 'Invalid company ID').transform(v => BigInt(v)),
})

export type CreateDidInput = z.infer<typeof createDidSchema>
export type UpdateDidInput = z.infer<typeof updateDidSchema>
