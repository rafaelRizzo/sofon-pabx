import { z } from 'zod'
import { COMPANY_STATUSES } from '../../../db/enums'

export const createCompanySchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    metadata: z.record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean()])
    ).optional(),
})

export const updateCompanySchema = createCompanySchema.extend({
    status: z.enum(COMPANY_STATUSES).optional(),
}).partial()

export const idParamSchema = z.object({
    id: z.string().uuid('Invalid company ID')
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
