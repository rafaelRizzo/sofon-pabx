import { z } from 'zod'
import { timestamp, ok } from '../../../../schemas/responses'

export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 200

// "atendimento" (nota do agente, entra em AgentAffinity) ou "servico" (nota do serviço contratado,
// só informativo - ver affinity.service.ts)
export const SURVEY_CATEGORIES = ['atendimento', 'servico'] as const

const ratingQueryShape = {
    companyId: z.cuid2(),
    extensionId: z.cuid2().optional(),
    number: z.string().max(80).optional(),
    // bate em scoreAtendimento OU scoreServico (1 linha por chamada carrega as 2 notas)
    score: z.coerce.number().int().min(1).max(5).optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
}

export const ratingQuerySchema = z.object({
    ...ratingQueryShape,
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    page: z.coerce.number().int().min(1).default(1),
    order: z.enum(['asc', 'desc']).default('desc'),
})

export type RatingQueryInput = z.infer<typeof ratingQuerySchema>

export const ratingExportQuerySchema = z.object({
    ...ratingQueryShape,
    order: z.enum(['asc', 'desc']).default('desc'),
})

export type RatingExportQueryInput = z.infer<typeof ratingExportQuerySchema>

// Input interno (chamado pelo AGI, 1x por pergunta) - o service faz upsert na mesma linha da
// chamada (companyId+uniqueid), category só decide em qual coluna (scoreAtendimento/scoreServico)
export const createRatingSchema = z.object({
    companyId: z.cuid2(),
    extensionId: z.cuid2(),
    number: z.string().min(1).max(80),
    uniqueid: z.string().max(150).optional(),
    score: z.number().int().min(1).max(5),
    category: z.enum(SURVEY_CATEGORIES).default('atendimento'),
})

export type CreateRatingInput = z.infer<typeof createRatingSchema>

export const ratingIdParamSchema = z.object({ id: z.cuid2() })

export const ratingRecordingQuerySchema = z.object({ companyId: z.cuid2() })

export const CallRatingSchema = z.object({
    id: z.string(),
    companyId: z.string(),
    extensionId: z.string(),
    number: z.string(),
    uniqueid: z.string().nullable(),
    // 1 linha por chamada - cada nota é null até a respectiva pergunta ser respondida
    scoreAtendimento: z.number().nullable(),
    scoreServico: z.number().nullable(),
    createdAt: timestamp,
    // resolvido em tempo de leitura (join solto por uniqueid com cdr.recordingFile) - sem FK,
    // ver comentário do campo uniqueid em schema.prisma
    hasRecording: z.boolean(),
})

export const ListRatingsResponse = ok({
    records: z.array(CallRatingSchema),
    total: z.number(),
    limit: z.number(),
    page: z.number(),
})

export const CreateRatingResponse = ok({ message: z.string(), ratingId: z.string() })
