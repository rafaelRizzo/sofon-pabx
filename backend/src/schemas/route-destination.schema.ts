import { z } from 'zod'

// Destino de roteamento compartilhado por Inbound Routes e Time Conditions
// (trueRoute/falseRoute). null = comportamento padrão do Asterisk (Hangup).
export const ROUTE_DEST_TYPES = ['extension', 'queue', 'voicemail', 'timecondition', 'announcement', 'hangup'] as const

const variants = <T extends z.ZodTypeAny>(idSchema: T) => [
    z.object({
        type: z.literal('extension').describe('Direciona a chamada para um ramal (Extension)'),
        id: idSchema,
    }),
    z.object({
        type: z.literal('queue').describe('Direciona a chamada para uma fila (Queue)'),
        id: idSchema,
    }),
    z.object({
        type: z.literal('voicemail').describe('Direciona a chamada para uma caixa de correio de voz'),
        id: idSchema,
    }),
    z.object({
        type: z.literal('timecondition').describe('Encadeia outra Time Condition (permite montar árvores de horário)'),
        id: idSchema,
    }),
    z.object({
        type: z.literal('announcement').describe('Toca um anúncio de áudio (Playback) e encerra a chamada — requer áudio já enviado'),
        id: idSchema,
    }),
    z.object({
        type: z.literal('hangup').describe('Encerra a chamada'),
    }),
] as const

export const routeDestinationSchema = z
    .discriminatedUnion('type', variants(z.cuid2()))
    .nullable()
    .describe(
        'Destino de roteamento. `id` é obrigatório para extension/queue/voicemail/timecondition/announcement (aponta pro registro correspondente) ' +
        'e ausente para hangup. `null` ou omitido equivale a hangup.',
    )

export const routeDestinationResponseSchema = z
    .union(variants(z.string()))
    .nullable()
    .describe('Destino de roteamento resolvido')

export type RouteDestination = z.infer<typeof routeDestinationSchema>
