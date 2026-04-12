import { z } from 'zod'

const TYPE_ERP = ['ixcsoft', 'sgp', 'hubsoft', 'radius_net'] as const

export const idParamSchema = z.object({
    id: z.uuid(),
})

export const companyParamSchema = z.object({
    company_id: z.uuid(),
})

export const createInstanceSchema = z.object({
    name: z.string().min(1).max(255),
    company_id: z.uuid(),
    type: z.enum(TYPE_ERP),
    auth: z.record(z.string(), z.unknown()),
    config: z.record(z.string(), z.unknown()),
    status: z.enum(['active', 'inactive']).default('active'),
})

export const updateInstanceSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    type: z.enum(TYPE_ERP).optional(),
    auth: z.record(z.string(), z.unknown()),
    config: z.record(z.string(), z.unknown()),
    status: z.enum(['active', 'inactive']).optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided' }
)

export type CreateInstanceInput = z.infer<typeof createInstanceSchema>
export type UpdateInstanceInput = z.infer<typeof updateInstanceSchema>