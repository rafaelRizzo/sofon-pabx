import { z } from 'zod'
import { timestamp, ok } from '../../../schemas/responses'
import { routeDestinationSchema, routeDestinationResponseSchema } from '../../../schemas/route-destination.schema'
import { usedBySchema } from '../../../schemas/flow-reference-label'

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
    wrapupTime: z.number().int().min(0).default(5),
    // id de um Audio (POST /audios) tocado uma única vez pro CLIENTE ao entrar na fila ("join announcement")
    announce: z.cuid2().nullable().optional(),
    // Frequência/toggle do "diz sua posição na fila" (só tem efeito com announcePosition=true)
    announceFrequency: z.number().int().min(0).default(0),
    announcePosition: z.boolean().default(false),
    // id de um Audio repetido periodicamente durante a espera (diferente do announce acima)
    periodicAnnounce: z.cuid2().nullable().optional(),
    periodicAnnounceFrequency: z.number().int().min(0).default(60),
    // id de um Audio tocado pro ATENDENTE bem antes de a ligação ser conectada ("agent announcement")
    agentAnnounce: z.cuid2().nullable().optional(),
    joinEmpty: z.boolean().default(true),
    leaveWhenEmpty: z.boolean().default(false),
    weight: z.number().int().min(0).default(0),
    postQueueDestination: routeDestinationSchema.optional(),
    // Áudio da pesquisa de satisfação pós-atendimento ("digite uma nota de 1 a 5") — null/omitido =
    // pesquisa desligada. Mesmo padrão hasAudio de Announcement/IvrMenu.
    surveyAudioId: z.cuid2().nullable().optional(),
    // Liga prioridade dinâmica (RoutingRule) e roteamento por afinidade (penalty) pra essa fila —
    // ver seção "Callcenter (Queue Engine)" no CLAUDE.md
    callcenterEnabled: z.boolean().default(false),
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
    announce: z.cuid2().nullable().optional(),
    announceFrequency: z.number().int().min(0).optional(),
    announcePosition: z.boolean().optional(),
    periodicAnnounce: z.cuid2().nullable().optional(),
    periodicAnnounceFrequency: z.number().int().min(0).optional(),
    agentAnnounce: z.cuid2().nullable().optional(),
    joinEmpty: z.boolean().optional(),
    leaveWhenEmpty: z.boolean().optional(),
    weight: z.number().int().min(0).optional(),
    postQueueDestination: routeDestinationSchema.optional(),
    surveyAudioId: z.cuid2().nullable().optional(),
    callcenterEnabled: z.boolean().optional(),
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
    announce: z.string().nullable(),
    announceFrequency: z.number(),
    announcePosition: z.boolean(),
    periodicAnnounce: z.string().nullable(),
    periodicAnnounceFrequency: z.number(),
    agentAnnounce: z.string().nullable(),
    weight: z.number(),
    joinEmpty: z.boolean(),
    leaveWhenEmpty: z.boolean(),
    postQueueDestination: routeDestinationResponseSchema,
    usedBy: usedBySchema,
    surveyAudioId: z.string().nullable(),
    hasSurveyAudio: z.boolean(),
    callcenterEnabled: z.boolean(),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListQueuesResponse = ok({ message: z.string(), queues: z.array(QueueSchema) })
export const GetQueueResponse = ok({ message: z.string(), queue: QueueSchema })
export const CreateQueueResponse = ok({ message: z.string(), queueId: z.string() })
export const UpdateQueueResponse = ok({ message: z.string() })
