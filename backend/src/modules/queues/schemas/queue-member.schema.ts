import { z } from 'zod'

export const addMemberSchema = z.object({
    extension_id: z.string().uuid('Invalid extension ID'),
    penalty: z.number().int().min(0).default(0),
    paused: z.boolean().default(false),
})

export const updateMemberSchema = z.object({
    penalty: z.number().int().min(0).optional(),
    paused: z.boolean().optional(),
})

export const queueIdParamSchema = z.object({
    queueId: z.string().uuid('Invalid queue ID'),
})

export const memberIdParamSchema = z.object({
    memberId: z.string().uuid('Invalid member ID'),
})

export type AddMemberInput = z.infer<typeof addMemberSchema>
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>
