import { z } from 'zod'
import { PLAN_STATUSES } from '../../../db/enums'

export const createPlanSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    price: z.coerce.number().positive('Price must be positive'),
    features: z.record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean()])
    ).optional()
})

export const updatePlanSchema = createPlanSchema.partial()

export const idParamSchema = z.object({
    id: z.string().uuid('Invalid plan ID')
})

export type CreatePlanInput = z.infer<typeof createPlanSchema>
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>
