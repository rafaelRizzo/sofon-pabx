// Prefixo "rt:" isola do único outro uso do Redis hoje (jti:, ver src/lib/jti.ts). Compartilhado
// entre ami-events.ts (escreve) e realtime.service.ts (lê) - nunca duplicar o formato da chave.

export const STATUS_TTL_SECONDS = 600 // rede de segurança: se o AMI cair sem reconectar, o status expira em vez de ficar "fantasma"
export const CALL_TTL_SECONDS = 4 * 60 * 60 // salvaguarda contra Hangup perdido - nenhuma chamada real dura tanto

export const extKey = (number: string) => `rt:ext:${number}`
export const extCallsKey = (number: string) => `rt:ext:calls:${number}`
export const callKey = (uniqueid: string) => `rt:call:${uniqueid}`
export const trunkKey = (astId: string) => `rt:trunk:${astId}`
export const trunkCallsKey = (astId: string) => `rt:trunk:calls:${astId}`
export const queueMembersKey = (queueName: string) => `rt:queue:members:${queueName}`
export const queueWaitingKey = (queueName: string) => `rt:queue:waiting:${queueName}`
export const bridgeMembersKey = (bridgeUniqueid: string) => `rt:bridge:${bridgeUniqueid}`

// Agregado próprio de "quanto tempo esperou até sair da fila" (QueueCallerJoin -> QueueCallerLeave),
// partido por dia local - não dá pra usar CDR pra isso: o Queue() atende o canal do ligante
// imediatamente pra tocar MOH, então duration-billsec do CDR não reflete o tempo até o agente
// atender (fica sempre ~0). Hash com campos "sum" (segundos) e "count". HOLDTIME_TTL_SECONDS
// cobre até o fim do dia seguinte, sem precisar de limpeza manual por data antiga.
export const HOLDTIME_TTL_SECONDS = 2 * 24 * 60 * 60
export const queueHoldtimeKey = (queueName: string, dateKey: string) => `rt:queue:holdtime:${queueName}:${dateKey}`
