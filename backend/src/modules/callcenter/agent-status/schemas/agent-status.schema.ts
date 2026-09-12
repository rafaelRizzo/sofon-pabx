import { z } from 'zod'
import { ok } from '../../../../schemas/responses'

// pauseReasonId obrigatório ao pausar (paused: true) - reforçado no service (assertPauseReason),
// não dá pra expressar "obrigatório condicionalmente ao outro campo" só com .refine aqui porque o
// service ainda precisa validar que o id pertence ao catálogo ativo da empresa do agente.
export const setAgentStatusSchema = z.object({
    paused: z.boolean(),
    pauseReasonId: z.cuid2().nullish(),
})

export type SetAgentStatusInput = z.infer<typeof setAgentStatusSchema>

const AgentStatusQueueSchema = z.object({
    queueId: z.string(),
    queueName: z.string(),
    queueNumber: z.string(),
    paused: z.boolean(),
    pauseReason: z.string().nullable(),
})

const AgentStatusReasonSchema = z.object({
    id: z.string(),
    label: z.string(),
})

export const AgentStatusSchema = z.object({
    extensionId: z.string(),
    paused: z.boolean(),
    pauseReason: z.string().nullable(),
    queues: z.array(AgentStatusQueueSchema),
    availableReasons: z.array(AgentStatusReasonSchema),
})

export const GetAgentStatusResponse = ok({ message: z.string(), status: AgentStatusSchema })
export const SetAgentStatusResponse = ok({ message: z.string(), status: AgentStatusSchema })
