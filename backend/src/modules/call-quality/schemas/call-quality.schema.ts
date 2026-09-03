import { z } from 'zod'
import { ok, timestamp } from '../../../schemas/responses'

export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 200

const callQualityQueryShape = {
    companyId: z.cuid2(),
    trunkId: z.cuid2().optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
}

const withDateRangeValidation = <T extends z.ZodRawShape>(shape: T) =>
    z.object(shape).refine(
        (value) => {
            const { startDate, endDate } = value as { startDate?: string; endDate?: string }
            return !startDate || !endDate || startDate <= endDate
        },
        { message: 'startDate must be before or equal to endDate', path: ['endDate'] }
    )

export const callQualityQuerySchema = withDateRangeValidation({
    ...callQualityQueryShape,
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    page: z.coerce.number().int().min(1).default(1),
    order: z.enum(['asc', 'desc']).default('desc'),
})

export type CallQualityQueryInput = z.infer<typeof callQualityQuerySchema>

export const callQualitySummaryQuerySchema = withDateRangeValidation(callQualityQueryShape)

export type CallQualitySummaryQueryInput = z.infer<typeof callQualitySummaryQuerySchema>

export const CallQualitySchema = z.object({
    id: z.string(),
    trunkId: z.string(),
    trunkName: z.string().nullable(),
    uniqueid: z.string(),
    linkedid: z.string().nullable(),
    callerNum: z.string().nullable(),
    channel: z.string(),
    startAt: timestamp,
    endAt: timestamp,
    avgRxJitterUnits: z.number().nullable(),
    avgRxLostPct: z.number().nullable(),
    rxSamples: z.number(),
    avgTxJitterUnits: z.number().nullable(),
    avgTxLostPct: z.number().nullable(),
    txSamples: z.number(),
    avgRttSeconds: z.number().nullable(),
    rttSamples: z.number(),
})

export const ListCallQualityResponse = ok({
    records: z.array(CallQualitySchema),
    total: z.number(),
    limit: z.number(),
    page: z.number(),
})

export const CallQualitySummarySchema = z.object({
    totalCalls: z.number(),
    avgRxJitterUnits: z.number().nullable(),
    avgRxLostPct: z.number().nullable(),
    avgTxJitterUnits: z.number().nullable(),
    avgTxLostPct: z.number().nullable(),
    avgRttSeconds: z.number().nullable(),
})

export const CallQualitySummaryResponse = ok({ summary: CallQualitySummarySchema })
