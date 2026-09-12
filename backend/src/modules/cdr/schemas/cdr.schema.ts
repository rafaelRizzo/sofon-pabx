import { z } from 'zod'
import { ok, timestamp } from '../../../schemas/responses'

export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 200

const cdrQueryShape = {
    companyId: z.cuid2(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    src: z.string().max(80).optional(),
    dst: z.string().max(80).optional(),
    callStatus: z
        .enum(['ANSWERED', 'NO ANSWER', 'BUSY', 'FAILED', 'CONGESTION'])
        .optional(),
    direction: z.enum(['inbound', 'outbound', 'internal', 'transfer']).optional(),
    originExtension: z.string().max(40).optional(),
    dialedNumber: z.string().max(80).optional(),
    trunkId: z.cuid2().optional(),
    queueName: z.string().max(160).optional(),
    queueId: z.cuid2().optional(),
    linkedid: z.string().max(150).optional(),
    uniqueid: z.string().max(150).optional()
}

const withDateRangeValidation = <T extends z.ZodRawShape>(shape: T) =>
    z.object(shape).refine(
        (value) => {
            const { startDate, endDate } = value as {
                startDate?: string
                endDate?: string
            }
            return !startDate || !endDate || startDate <= endDate
        },
        {
            message: 'startDate must be before or equal to endDate',
            path: ['endDate']
        }
    )

export const cdrQuerySchema = withDateRangeValidation({
    ...cdrQueryShape,
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    page: z.coerce.number().int().min(1).default(1),
    order: z.enum(['asc', 'desc']).default('desc')
})

export type CdrQueryInput = z.infer<typeof cdrQuerySchema>

export const cdrMetricsQuerySchema = withDateRangeValidation(cdrQueryShape)

export type CdrMetricsQueryInput = z.infer<typeof cdrMetricsQuerySchema>

export const cdrExportQuerySchema = withDateRangeValidation({
    ...cdrQueryShape,
    order: z.enum(['asc', 'desc']).default('desc')
})

export type CdrExportQueryInput = z.infer<typeof cdrExportQuerySchema>

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
    queueName: z.string().nullable(),
    linkedid: z.string().nullable(),
    sequence: z.number().nullable(),
    direction: z.string().nullable(),
    originExtension: z.string().nullable(),
    dialedNumber: z.string().nullable(),
    trunkId: z.string().nullable(),
    recordingFile: z.string().nullable(),
    hangupCause: z.string().nullable(),
    // Resolvidos em tempo de leitura (cdr-enrichment.ts) - não vêm de coluna nenhuma do banco.
    // Cobrem o caso de chamadas roteadas por Flow, onde queueName/direction/trunkId do dialplan
    // nem sempre sobrevivem até o fim da chamada (ver comentário em cdr.service.ts)
    queueLabel: z.string().nullable(),
    destinationLabel: z.string().nullable(),
    answeredBy: z
        .object({ extensionId: z.string(), label: z.string() })
        .nullable(),
    originLabel: z.string().nullable(),
    // Tempo de espera (fila até o agente atender) e tempo em ligação após atendida - vem do
    // QueueCall associado (mesmo uniqueid do canal do chamador), null pra chamadas que não
    // passaram por fila (ramal->ramal, outbound direto)
    queueWaitSeconds: z.number().nullable(),
    queueTalkSeconds: z.number().nullable()
})

export const ListCdrResponse = ok({
    records: z.array(CdrSchema),
    total: z.number(),
    limit: z.number(),
    page: z.number()
})

// /cdr/me - últimas N chamadas do ramal do usuário logado, sem paginação (é uma janela fixa,
// não uma listagem navegável)
export const MyRecentCallsResponse = ok({
    records: z.array(CdrSchema)
})

export const CdrMetricsSchema = z.object({
    total: z.number(),
    answered: z.number(),
    answerRate: z.number(),
    totalDuration: z.number(),
    totalBillsec: z.number(),
    avgDuration: z.number().nullable(),
    avgBillsec: z.number().nullable(),
    byStatus: z.array(
        z.object({ callStatus: z.string().nullable(), calls: z.number() })
    ),
    byDirection: z.array(
        z.object({ direction: z.string().nullable(), calls: z.number() })
    )
})

export const CdrMetricsResponse = ok({ metrics: CdrMetricsSchema })

export const cdrIdParamSchema = z.object({ id: z.coerce.bigint().positive() })

export const cdrRecordingQuerySchema = z.object({ companyId: z.cuid2() })
