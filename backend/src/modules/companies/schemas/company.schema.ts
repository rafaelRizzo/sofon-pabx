import { z } from 'zod'
import { COMPANY_STATUSES } from '../../../db/enums'
import { snowflakeId } from '../../../utils/validators/snowflake.validator'

export const createCompanySchema = z.object({
    owner_id: snowflakeId('owner ID').optional(),
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    obs: z.string().max(1000, 'Obs must be 1000 characters or less').optional(),
})

export const updateCompanySchema = createCompanySchema.extend({
    status: z.enum(COMPANY_STATUSES).optional(),
}).partial()

export const idParamSchema = z.object({
    id: snowflakeId('company ID'),
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
