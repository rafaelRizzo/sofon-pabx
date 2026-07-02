import { z } from 'zod'
import { timestamp, ok } from '../../../schemas/responses'

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

export const companyQuerySchema = z.object({
    companyId: z.cuid2(),
})

export const createQueueSchema = z.object({
    name: z
        .string()
        .min(1)
        .max(80)
        .regex(/^[a-z0-9_-]+$/i, 'Only alphanumeric, dash and underscore allowed'),
    number: z.coerce.string().min(1).max(20).regex(/^\d+$/, 'Only digits allowed'),
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
    number: z.coerce.string().min(1).max(20).regex(/^\d+$/, 'Only digits allowed').optional(),
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

export type CreateQueueInput = z.infer<typeof createQueueSchema>
export type UpdateQueueInput = z.infer<typeof updateQueueSchema>

export const QueueSchema = z.object({
    id: z.string(),
    name: z.string(),
    number: z.string(),
    companyId: z.string(),
    strategy: z.string(),
    musicOnHold: z.string(),
    timeout: z.number(),
    retry: z.number(),
    maxLen: z.number(),
    wrapupTime: z.number(),
    weight: z.number(),
    joinEmpty: z.boolean(),
    leaveWhenEmpty: z.boolean(),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListQueuesResponse = ok({ message: z.string(), queues: z.array(QueueSchema) })
export const GetQueueResponse = ok({ message: z.string(), queue: QueueSchema })
export const CreateQueueResponse = ok({ message: z.string(), queueId: z.string() })
export const UpdateQueueResponse = ok({ message: z.string() })
