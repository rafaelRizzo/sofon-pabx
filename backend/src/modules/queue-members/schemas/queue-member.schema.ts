import { z } from 'zod'
import { ok } from '../../../schemas/responses'

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

export const QueueMemberSchema = z.object({
    id: z.string(),
    queueId: z.string(),
    extensionId: z.string(),
    penalty: z.number(),
    paused: z.boolean(),
})

export const ListMembersResponse = ok({ message: z.string(), members: z.array(QueueMemberSchema) })
export const AddMemberResponse = ok({ message: z.string(), memberId: z.string() })
export const UpdateMemberResponse = ok({ message: z.string() })
