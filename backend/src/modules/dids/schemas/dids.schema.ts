import { z } from 'zod'
import { snowflakeId } from '../../../utils/validators/snowflake.validator'

export const createDidSchema = z.object({
    company_id: snowflakeId('company ID'),
    number: z.string().min(1, 'DID number is required').max(20),
    description: z.string().max(255).optional(),
})

export const updateDidSchema = z.object({
    number: z.string().min(1).max(20).optional(),
    description: z.string().max(255).optional(),
    status: z.enum(['active', 'inactive']).optional(),
})

export const idParamSchema = z.object({
    id: snowflakeId('DID ID'),
})

export const companyIdParamSchema = z.object({
    company_id: snowflakeId('company ID'),
})

export type CreateDidInput = z.infer<typeof createDidSchema>
export type UpdateDidInput = z.infer<typeof updateDidSchema>
