import { z } from 'zod'
import { ok } from '../../../schemas/responses'

export const presenceEnum = z.enum(['online', 'offline', 'unknown'])
export const callStateEnum = z.enum(['idle', 'ringing', 'in_call', 'busy', 'unavailable', 'unknown'])

const activeCallSchema = z.object({
    uniqueid: z.string(),
    callerNum: z.string(),
    startAt: z.number().nullable(),
    bridgedWith: z.string().nullable(),
    // nome do tronco por onde a ligação entrou - null se for chamada interna (ramal->ramal) ou se
    // o par ainda não foi capturado (ver handleDialBegin em ami-events.ts)
    trunkName: z.string().nullable(),
})

const extensionStatusSchema = z.object({
    id: z.string(),
    alias: z.string(),
    number: z.string(),
    name: z.string(),
    type: z.string(),
    companyId: z.string(),
    presence: presenceEnum,
    callState: callStateEnum,
    activeCalls: z.array(activeCallSchema),
})

const trunkStatusSchema = z.object({
    id: z.string(),
    name: z.string(),
    companyId: z.string(),
    type: z.string(),
    registrationMode: z.string(),
    presence: presenceEnum,
    expirySeconds: z.number().nullable(),
})

const queueMemberStatusSchema = z.object({
    extensionId: z.string(),
    number: z.string(),
    name: z.string(),
    penalty: z.number(),
    paused: z.boolean(),
    pauseReason: z.string().nullable(),
    status: callStateEnum,
})

const queueWaitingCallerSchema = z.object({
    uniqueid: z.string(),
    callerNum: z.string(),
    waitingSeconds: z.number(),
})

const queueStatusSchema = z.object({
    id: z.string(),
    name: z.string(),
    number: z.string(),
    companyId: z.string(),
    calls: z.number(),
    // Média de hoje calculada a partir do próprio par QueueCallerJoin/Leave (ver
    // handleQueueCallerLeave em ami-events.ts), não o QueueParams.Holdtime ao vivo do AMI nem o
    // CDR - o CDR não serve pra isso (Queue() atende o canal do ligante já na entrada, pra MOH,
    // então duration-billsec fica sempre ~0). holdtimeSampleSize=0 quer dizer "ninguém saiu da
    // fila hoje ainda", não "média literalmente zero".
    holdtime: z.number(),
    holdtimeSampleSize: z.number(),
    members: z.array(queueMemberStatusSchema),
    waiting: z.array(queueWaitingCallerSchema),
})

export const ListRealtimeExtensionsResponse = ok({ extensions: z.array(extensionStatusSchema) })
export const ListRealtimeTrunksResponse = ok({ trunks: z.array(trunkStatusSchema) })
export const ListRealtimeQueuesResponse = ok({ queues: z.array(queueStatusSchema) })
