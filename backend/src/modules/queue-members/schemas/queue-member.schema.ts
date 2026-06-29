import { z } from 'zod'

export const memberIdParamSchema = z.object({
    id: z.cuid2(),
    memberId: z.cuid2(),
})

export const queueIdParamSchema = z.object({
    id: z.cuid2(),
})

export const addMemberSchema = z.object({
    extensionId: z.cuid2(),
    penalty: z.number().int().min(0).max(100).default(0),
    paused: z.boolean().default(false),
})

export const updateMemberSchema = z.object({
    penalty: z.number().int().min(0).max(100).optional(),
    paused: z.boolean().optional(),
})

export type AddMemberInput = z.infer<typeof addMemberSchema>
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>
