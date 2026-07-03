import { z } from 'zod'
import { ok, timestamp } from '../../../schemas/responses'

export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 200

export const cdrQuerySchema = z.object({
    companyId: z.cuid2(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    src: z.string().max(80).optional(),
    dst: z.string().max(80).optional(),
    callStatus: z.enum(['ANSWERED', 'NO ANSWER', 'BUSY', 'FAILED', 'CONGESTION']).optional(),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    order: z.enum(['asc', 'desc']).default('desc'),
})

export type CdrQueryInput = z.infer<typeof cdrQuerySchema>

export const CdrSchema = z.object({
    id: z.string(),
    src: z.string().nullable(),
    dst: z.string().nullable(),
    context: z.string().nullable(),
    callerid: z.string().nullable(),
    srcChannel: z.string().nullable(),
    dstChannel: z.string().nullable(),
    lastApp: z.string().nullable(),
    lastData: z.string().nullable(),
    startTime: timestamp.nullable(),
    answerTime: timestamp.nullable(),
    endTime: timestamp.nullable(),
    duration: z.number().nullable(),
    billsec: z.number().nullable(),
    callStatus: z.string().nullable(),
    uniqueid: z.string().nullable(),
})

export const ListCdrResponse = ok({
    records: z.array(CdrSchema),
    total: z.number(),
    limit: z.number(),
})
