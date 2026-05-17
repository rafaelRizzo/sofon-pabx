import { z } from 'zod'
import { ERP_TYPES } from '../../../db/enums'

const baseSchema = z.object({
    company_id: z.string().regex(/^\d+$/, 'Invalid company ID').transform(v => BigInt(v)),
    name: z.string().min(1, 'Name is required').max(255),
    url: z.url('Invalid URL'),
})

const sgpSchema = baseSchema.extend({
    erp_type: z.literal('sgp'),
})

const ixcsoftSchema = baseSchema.extend({
    erp_type: z.literal('ixcsoft'),
})

const hubsoftSchema = baseSchema.extend({
    erp_type: z.literal('hubsoft'),
})

export const createInstanceSchema = z.discriminatedUnion('erp_type', [
    sgpSchema,
    ixcsoftSchema,
    hubsoftSchema,
])

export const updateInstanceSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    url: z.url().optional(),
    erp_type: z.enum(ERP_TYPES).optional(),
})

export const idParamSchema = z.object({
    id: z.string().regex(/^\d+$/, 'Invalid instance ID').transform(v => BigInt(v)),
})

export const companyIdParamSchema = z.object({
    company_id: z.string().regex(/^\d+$/, 'Invalid company ID').transform(v => BigInt(v)),
})

export type CreateInstanceInput = z.infer<typeof createInstanceSchema>
export type UpdateInstanceInput = z.infer<typeof updateInstanceSchema>
