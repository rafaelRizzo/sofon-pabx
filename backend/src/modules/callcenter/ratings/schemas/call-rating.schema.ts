import { z } from 'zod'
import { timestamp, ok } from '../../../../schemas/responses'

export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 200

// "atendimento" (nota do agente, entra em AgentAffinity) ou "servico" (nota do serviço contratado,
// só informativo - ver affinity.service.ts)
export const SURVEY_CATEGORIES = ['atendimento', 'servico'] as const

export const ratingQuerySchema = z.object({
    companyId: z.cuid2(),
    extensionId: z.cuid2().optional(),
    number: z.string().max(80).optional(),
    score: z.coerce.number().int().min(1).max(5).optional(),
    category: z.enum(SURVEY_CATEGORIES).optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    order: z.enum(['asc', 'desc']).default('desc'),
})

export type RatingQueryInput = z.infer<typeof ratingQuerySchema>

export const createRatingSchema = z.object({
    companyId: z.cuid2(),
    extensionId: z.cuid2(),
    number: z.string().min(1).max(80),
    uniqueid: z.string().max(150).optional(),
    score: z.number().int().min(1).max(5),
    category: z.enum(SURVEY_CATEGORIES).default('atendimento'),
})

export type CreateRatingInput = z.infer<typeof createRatingSchema>

export const CallRatingSchema = z.object({
    id: z.string(),
    companyId: z.string(),
    extensionId: z.string(),
    number: z.string(),
    uniqueid: z.string().nullable(),
    score: z.number(),
    category: z.enum(SURVEY_CATEGORIES),
    createdAt: timestamp,
})

export const ListRatingsResponse = ok({
    records: z.array(CallRatingSchema),
    total: z.number(),
    limit: z.number(),
})

export const CreateRatingResponse = ok({ message: z.string(), ratingId: z.string() })
