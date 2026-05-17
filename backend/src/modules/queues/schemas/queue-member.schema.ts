import { z } from 'zod'
import { snowflakeId } from '../../../utils/validators/snowflake.validator'

export const addMemberSchema = z.object({
    extension_id: snowflakeId('extension ID'),
    penalty: z.number().int().min(0).default(0),
    paused: z.boolean().default(false),
})

export const updateMemberSchema = z.object({
    penalty: z.number().int().min(0).optional(),
    paused: z.boolean().optional(),
})

export const queueIdParamSchema = z.object({
    queueId: snowflakeId('queue ID'),
})

export const memberIdParamSchema = z.object({
    memberId: z.string().regex(/^\d+$/, 'Invalid member ID').transform(v => BigInt(v)),
})

export type AddMemberInput = z.infer<typeof addMemberSchema>
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>
