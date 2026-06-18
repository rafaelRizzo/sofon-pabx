import { z } from 'zod'

export const QUEUE_STRATEGIES = [
    'ringall',
    'leastrecent',
    'fewestcalls',
    'random',
    'rrmemory',
    'linear',
    'wrandom',
] as const

export const idParamSchema = z.object({
    id: z.cuid2(),
})

export const companyIdParamSchema = z.object({
    id_company: z.cuid2(),
})

export const memberIdParamSchema = z.object({
    id: z.cuid2(),
    memberId: z.cuid2(),
})

export const companyQuerySchema = z.object({
    companyId: z.cuid2(),
})

export const createQueueSchema = z.object({
    name: z
        .string()
        .min(1)
        .max(80)
        .regex(/^[a-z0-9_-]+$/i, 'Only alphanumeric, dash and underscore allowed'),
    number: z.string().min(1).max(20).regex(/^\d+$/, 'Only digits allowed').optional(),
    companyId: z.cuid2(),
    strategy: z.enum(QUEUE_STRATEGIES).default('ringall'),
    musicOnHold: z.string().min(1).max(128).default('default'),
    timeout: z.number().int().min(1).max(300).default(15),
    retry: z.number().int().min(1).max(300).default(5),
    maxLen: z.number().int().min(0).default(0),
    wrapupTime: z.number().int().min(0).default(0),
    announce: z.string().max(128).optional(),
    announceFrequency: z.number().int().min(0).default(0),
    joinEmpty: z.boolean().default(true),
    leaveWhenEmpty: z.boolean().default(false),
    weight: z.number().int().min(0).default(0),
})

export const updateQueueSchema = z.object({
    name: z
        .string()
        .min(1)
        .max(80)
        .regex(/^[a-z0-9_-]+$/i, 'Only alphanumeric, dash and underscore allowed')
        .optional(),
    number: z.string().min(1).max(20).regex(/^\d+$/, 'Only digits allowed').optional().nullable(),
    strategy: z.enum(QUEUE_STRATEGIES).optional(),
    musicOnHold: z.string().min(1).max(128).optional(),
    timeout: z.number().int().min(1).max(300).optional(),
    retry: z.number().int().min(1).max(300).optional(),
    maxLen: z.number().int().min(0).optional(),
    wrapupTime: z.number().int().min(0).optional(),
    announce: z.string().max(128).optional(),
    announceFrequency: z.number().int().min(0).optional(),
    joinEmpty: z.boolean().optional(),
    leaveWhenEmpty: z.boolean().optional(),
    weight: z.number().int().min(0).optional(),
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

export type CreateQueueInput = z.infer<typeof createQueueSchema>
export type UpdateQueueInput = z.infer<typeof updateQueueSchema>
export type AddMemberInput = z.infer<typeof addMemberSchema>
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>
