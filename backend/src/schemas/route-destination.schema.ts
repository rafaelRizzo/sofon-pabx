import { z } from 'zod'

/**
 * Destino de roteamento — shape compartilhado por:
 *   - Inbound Routes      → `destination`
 *   - Time Conditions     → `trueRoute` / `falseRoute`
 *   - Queues              → `postQueueDestination`
 *   - IVR Menus           → `invalidDestination` / `timeoutDestination` / `longDestination` / opção de dígito
 *   - Request Templates   → `onSuccess` / `onError`
 *
 * Tipos disponíveis:
 *
 * | type            | id obrigatório | Asterisk                                                       | Restrições                                      |
 * |-----------------|:--------------:|----------------------------------------------------------------|-------------------------------------------------|
 * | extension       | ✔              | Goto(ramais,<alias>_<asteriskId>,1)                            | mesma empresa                                   |
 * | queue           | ✔              | Goto(queues-app,<asteriskId>-<number>,1)                       | mesma empresa; queue.number não pode ser null   |
 * | voicemail       | ✔              | VoiceMail(<id>@default)                                        | id livre, sem FK validada                       |
 * | timecondition   | ✔              | Goto(timeconditions,tc-<id>,1)                                 | mesma empresa; permite encadear árvores         |
 * | holiday         | ✔              | Goto(holidays,hol-<id>,1)                                      | mesma empresa; aponta pra um Holiday Group      |
 * | announcement    | ✔              | Goto(announcements,ann-<id>,1)                                 | mesma empresa; requer audioId preenchido        |
 * | ivr             | ✔              | Goto(ivrs,ivr-<id>,1)                                          | mesma empresa; requer audioId preenchido        |
 * | request         | ✔              | AGI síncrono → trava chamada até resposta HTTP; roteamento     |                                                 |
 * |                 |                | continua por onSuccess/onError do template                     | mesma empresa                                   |
 * | hangup          | ✗              | Hangup()                                                       | —                                               |
 *
 * `null` ou campo omitido equivale a `{ type: "hangup" }`.
 *
 * Validação de existência/posse centralizada em `validateRouteDestination()`
 * (src/schemas/route-destination.validate.ts) — não duplicar o switch-case.
 */
export const ROUTE_DEST_TYPES = ['extension', 'queue', 'voicemail', 'timecondition', 'holiday', 'announcement', 'ivr', 'request', 'hangup'] as const

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
        type: z.literal('holiday').describe('Encadeia um Holiday Group (lista de datas manual ou auto-atualizada por URL)'),
        id: idSchema,
    }),
    z.object({
        type: z.literal('announcement').describe('Toca um anúncio de áudio (Playback) e encerra a chamada — requer áudio já enviado'),
        id: idSchema,
    }),
    z.object({
        type: z.literal('ivr').describe('Direciona a chamada para um menu de URA (IVR) — requer áudio já enviado'),
        id: idSchema,
    }),
    z.object({
        type: z.literal('request').describe(
            'Executa um Request Template via AGI (síncrono, trava a chamada até a resposta HTTP) — ' +
            'variáveis extraídas do response ficam disponíveis no canal; roteamento continua por onSuccess/onError do template',
        ),
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
