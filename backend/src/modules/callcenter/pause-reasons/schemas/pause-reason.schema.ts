import { z } from 'zod'
import { timestamp, ok } from '../../../../schemas/responses'

export const idParamSchema = z.object({ id: z.cuid2() })
export const companyIdParamSchema = z.object({ id_company: z.cuid2() })

export const createPauseReasonSchema = z.object({
    companyId: z.cuid2(),
    label: z.string().min(1).max(60),
    active: z.boolean().default(true),
})

export const updatePauseReasonSchema = z
    .object({
        label: z.string().min(1).max(60).optional(),
        active: z.boolean().optional(),
    })
    .refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' })

export type CreatePauseReasonInput = z.infer<typeof createPauseReasonSchema>
export type UpdatePauseReasonInput = z.infer<typeof updatePauseReasonSchema>

export const PauseReasonSchema = z.object({
    id: z.string(),
    companyId: z.string(),
    label: z.string(),
    active: z.boolean(),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListPauseReasonsResponse = ok({ message: z.string(), pauseReasons: z.array(PauseReasonSchema) })
export const CreatePauseReasonResponse = ok({ message: z.string(), pauseReasonId: z.string() })
export const UpdatePauseReasonResponse = ok({ message: z.string() })
