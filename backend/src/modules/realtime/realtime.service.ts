import { prisma } from '../../lib/prisma'
import { redisClient } from '../../config/redis'
import { logger } from '../../utils/logger'
import { getCompanyById } from '../companies/companies.service'
import { toAsteriskId } from '../trunks/trunks.service'
import { toAsteriskQueueName, toAsteriskInterface } from '../../asterisk/queue.repository'
import { isTrunkId, extensionNumberFromChannel } from '../../asterisk/ami-events'
import { extKey, extCallsKey, callKey, trunkKey, queueMembersKey, queueWaitingKey, queueHoldtimeKey } from '../../asterisk/realtime-keys'

const TZ = process.env.TZ || 'America/Sao_Paulo'

// Leitura tolerante a falha do Redis: uma chave que não responde vira 'unknown' pro item, nunca
// derruba a rota inteira (mesmo padrão defensivo dos handlers de escrita em ami-events.ts)
async function safeHGetAll(key: string): Promise<Record<string, string>> {
    try {
        return await redisClient.hGetAll(key)
    } catch (error) {
        logger.warn({ event: 'realtime.redis.read_failed', key, message: error instanceof Error ? error.message : String(error) })
        return {}
    }
}

async function safeSMembers(key: string): Promise<string[]> {
    try {
        return await redisClient.sMembers(key)
    } catch {
        return []
    }
}

async function safeZRangeWithScores(key: string): Promise<{ uniqueid: string; waitingSince: number }[]> {
    try {
        const members = await redisClient.zRangeWithScores(key, 0, -1)
        return members.map((m) => ({ uniqueid: m.value, waitingSince: m.score }))
    } catch {
        return []
    }
}

// callerNum não é gravado no sorted set (só uniqueid/score) - o Newchannel já populou
// rt:call:<uniqueid> antes do caller entrar na fila, então enriquece aqui na leitura
async function withCallerInfo(waiting: { uniqueid: string; waitingSince: number }[]) {
    return Promise.all(waiting.map(async (w) => {
        const call = await safeHGetAll(callKey(w.uniqueid))
        return {
            uniqueid: w.uniqueid,
            callerNum: call.callerNum ?? '',
            waitingSeconds: Math.max(0, Math.round((Date.now() - w.waitingSince) / 1000)),
        }
    }))
}

// Agregado próprio (join/leave via AMI, ver handleQueueCallerLeave em ami-events.ts), não CDR:
// Queue() atende o canal do ligante na hora que ele entra na fila (pra tocar MOH), então
// duration-billsec do CDR fica sempre ~0, não reflete o tempo até o agente atender de verdade.
async function getQueueHoldtimeToday(asteriskName: string): Promise<{ avgHoldtimeSeconds: number; sampleSize: number }> {
    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
    const raw = await safeHGetAll(queueHoldtimeKey(asteriskName, dateKey))
    const sum = raw.sum ? Number(raw.sum) : 0
    const count = raw.count ? Number(raw.count) : 0
    if (count === 0) return { avgHoldtimeSeconds: 0, sampleSize: 0 }
    return { avgHoldtimeSeconds: Math.round(sum / count), sampleSize: count }
}

const extensionSelect = {
    id: true, alias: true, number: true, name: true, type: true, companyId: true,
    company: { select: { asteriskId: true } },
} as const

export const getExtensionsStatus = async (companyIds?: string[]) => {
    if (companyIds && companyIds.length === 0) return []

    const extensions = await prisma.extension.findMany({
        where: companyIds ? { companyId: { in: companyIds } } : undefined,
        select: extensionSelect,
    })

    return Promise.all(extensions.map(async (ext) => {
        const { company, ...extRest } = ext
        const [status, callUniqueids] = await Promise.all([
            safeHGetAll(extKey(ext.number)),
            safeSMembers(extCallsKey(ext.number)),
        ])

        // peerChannel (gravado por handleDialBegin, ami-events.ts) é o canal de quem discou pra
        // esse ramal - se for um tronco, extrai o nome cru removendo o prefixo `<asteriskId>-trunk-`
        // (toAsteriskId em trunks.service.ts) em vez de bater no banco por tronco
        const trunkPrefix = `${company.asteriskId}-trunk-`
        const activeCallsRaw = await Promise.all(callUniqueids.map(async (uniqueid) => {
            const call = await safeHGetAll(callKey(uniqueid))
            if (Object.keys(call).length === 0) return null
            const peerNumber = call.peerChannel ? extensionNumberFromChannel(call.peerChannel) : null
            const trunkName = peerNumber && isTrunkId(peerNumber) && peerNumber.startsWith(trunkPrefix)
                ? peerNumber.slice(trunkPrefix.length)
                : null
            return {
                uniqueid,
                callerNum: call.callerNum ?? '',
                startAt: call.startAt ? Number(call.startAt) : null,
                bridgedWith: call.bridgedWith ?? null,
                trunkName,
            }
        }))
        // órfão: uniqueid ainda no set mas o hash já expirou/sumiu (Hangup perdido) - descarta na leitura
        const activeCalls = activeCallsRaw.filter((c): c is NonNullable<typeof c> => c !== null)

        return {
            ...extRest,
            presence: status.presence === 'online' || status.presence === 'offline' ? status.presence : 'unknown',
            callState: (['idle', 'ringing', 'in_call', 'busy', 'unavailable'] as const).includes(status.callState as any)
                ? (status.callState as 'idle' | 'ringing' | 'in_call' | 'busy' | 'unavailable')
                : 'unknown',
            activeCalls,
        }
    }))
}

const trunkSelect = {
    id: true, name: true, companyId: true, type: true, registrationMode: true,
} as const

export const getTrunksStatus = async (companyIds?: string[]) => {
    if (companyIds && companyIds.length === 0) return []

    const trunks = await prisma.trunk.findMany({
        where: companyIds ? { companyId: { in: companyIds } } : undefined,
        select: trunkSelect,
    })
    if (trunks.length === 0) return []

    const uniqueCompanyIds = [...new Set(trunks.map((t) => t.companyId))]
    const asteriskIdByCompany = new Map<string, string>()
    await Promise.all(uniqueCompanyIds.map(async (id) => {
        const company = await getCompanyById(id)
        asteriskIdByCompany.set(id, company.asteriskId)
    }))

    return Promise.all(trunks.map(async (trunk) => {
        const astId = toAsteriskId(asteriskIdByCompany.get(trunk.companyId)!, trunk.name)
        const status = await safeHGetAll(trunkKey(astId))
        return {
            ...trunk,
            presence: status.presence === 'online' || status.presence === 'offline' ? status.presence : 'unknown',
            // Intervalo de registro configurado (segundos) - só existe pra troncos outbound PJSIP
            // com registro (ver hydratePjsipRegistrations em ami-events.ts); null pros demais
            expirySeconds: status.expirySeconds ? Number(status.expirySeconds) : null,
        }
    }))
}

export const getQueuesStatus = async (companyIds?: string[]) => {
    if (companyIds && companyIds.length === 0) return []

    const queues = await prisma.queue.findMany({
        where: companyIds ? { companyId: { in: companyIds } } : undefined,
        select: {
            id: true, name: true, number: true, companyId: true,
            company: { select: { asteriskId: true } },
            members: {
                select: {
                    penalty: true, paused: true, pauseReason: true,
                    extension: { select: { id: true, number: true, name: true, type: true } },
                },
            },
        },
    })

    return Promise.all(queues.map(async (queue) => {
        const asteriskName = toAsteriskQueueName(queue.company.asteriskId, queue.number)
        const [membersRaw, waitingRaw, holdtime] = await Promise.all([
            safeHGetAll(queueMembersKey(asteriskName)),
            safeZRangeWithScores(queueWaitingKey(asteriskName)),
            getQueueHoldtimeToday(asteriskName),
        ])
        const waiting = await withCallerInfo(waitingRaw)

        const members = queue.members.map((m) => {
            const iface = toAsteriskInterface(m.extension.type, m.extension.number)
            const live = membersRaw[iface] ? JSON.parse(membersRaw[iface]!) : null
            return {
                extensionId: m.extension.id,
                number: m.extension.number,
                name: m.extension.name,
                penalty: m.penalty,
                paused: m.paused,
                pauseReason: m.pauseReason,
                status: live?.status ?? 'unknown',
            }
        })

        return {
            id: queue.id,
            name: queue.name,
            number: queue.number,
            companyId: queue.companyId,
            // Ao vivo via QueueCallerJoin/Leave (queueWaitingKey), não o QueueParams.Calls do
            // snapshot periódico do AMI (esse só atualizava a cada 30s/no login - parecia
            // "não tão realtime assim" enquanto "Aguardando" já era instantâneo)
            calls: waiting.length,
            holdtime: holdtime.avgHoldtimeSeconds,
            holdtimeSampleSize: holdtime.sampleSize,
            members,
            waiting,
        }
    }))
}
