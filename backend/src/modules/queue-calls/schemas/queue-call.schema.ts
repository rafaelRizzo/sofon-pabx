import { z } from 'zod'
import { timestamp, ok } from '../../../schemas/responses'

export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 200
export const DEFAULT_SLA_SECONDS = 20

export const queueCallOutcomes = ['answered', 'abandoned', 'timeout', 'empty', 'exit_key', 'transfer', 'failed'] as const
export type QueueCallOutcome = (typeof queueCallOutcomes)[number]

export const queueCallQuerySchema = z.object({
    companyId: z.cuid2(),
    queueId: z.cuid2().optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    outcome: z.enum(queueCallOutcomes).optional(),
    agentExtensionId: z.cuid2().optional(),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    cursor: z.string().optional(),
})

export type QueueCallQueryInput = z.infer<typeof queueCallQuerySchema>

export const queueCallMetricsQuerySchema = z.object({
    companyId: z.cuid2(),
    queueId: z.cuid2().optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    slaSeconds: z.coerce.number().int().min(1).max(3600).default(DEFAULT_SLA_SECONDS),
})

export type QueueCallMetricsQueryInput = z.infer<typeof queueCallMetricsQuerySchema>

export const QueueCallSchema = z.object({
    id: z.string(),
    companyId: z.string(),
    queueId: z.string().nullable(),
    queueName: z.string(),
    callerUniqueid: z.string(),
    linkedid: z.string().nullable(),
    src: z.string().nullable(),
    enteredAt: timestamp,
    connectedAt: timestamp.nullable(),
    endedAt: timestamp.nullable(),
    outcome: z.string().nullable(),
    exitReason: z.string().nullable(),
    agentExtensionId: z.string().nullable(),
    agentInterface: z.string().nullable(),
    waitSeconds: z.number().nullable(),
    ringSeconds: z.number().nullable(),
    talkSeconds: z.number().nullable(),
    initialPosition: z.number().nullable(),
    finalPosition: z.number().nullable(),
    recordingFile: z.string().nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListQueueCallsResponse = ok({
    records: z.array(QueueCallSchema),
    nextCursor: z.string().nullable(),
})

export const QueueCallMetricsSchema = z.object({
    offered: z.number(),
    answered: z.number(),
    abandoned: z.number(),
    abandonRate: z.number(),
    slaSeconds: z.number(),
    slaCompliant: z.number(),
    slaRate: z.number(),
    avgWaitSeconds: z.number().nullable(),
    medianWaitSeconds: z.number().nullable(),
    avgTalkSeconds: z.number().nullable(),
    byAgent: z.array(z.object({
        agentExtensionId: z.string(),
        calls: z.number(),
        avgTalkSeconds: z.number().nullable(),
    })),
})

export const QueueCallMetricsResponse = ok({ metrics: QueueCallMetricsSchema })
