import { prisma } from '../../lib/prisma'
import { Prisma } from '../../../generated/prisma/client'
import { getCompanyById } from '../companies/companies.service'
import { logger } from '../../utils/logger'
import { parseAsteriskQueueName, parseMemberInterface } from '../../asterisk/queue.repository'
import type { QueueCallQueryInput, QueueCallMetricsQueryInput } from './schemas/queue-call.schema'

export const listQueueCalls = async (query: QueueCallQueryInput) => {
    await getCompanyById(query.companyId)

    const where = {
        companyId: query.companyId,
        ...(query.queueId && { queueId: query.queueId }),
        ...(query.outcome && { outcome: query.outcome }),
        ...(query.agentExtensionId && { agentExtensionId: query.agentExtensionId }),
        ...((query.startDate || query.endDate) && {
            enteredAt: {
                ...(query.startDate && { gte: new Date(`${query.startDate}T00:00:00.000Z`) }),
                ...(query.endDate && { lte: new Date(`${query.endDate}T23:59:59.999Z`) }),
            },
        }),
    }

    const records = await prisma.queueCall.findMany({
        where,
        orderBy: [{ enteredAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    })

    const hasMore = records.length > query.limit
    const page = hasMore ? records.slice(0, query.limit) : records
    return { records: page, nextCursor: hasMore ? page[page.length - 1]!.id : null }
}

export const getQueueCallMetrics = async (query: QueueCallMetricsQueryInput) => {
    await getCompanyById(query.companyId)

    const where: Prisma.QueueCallWhereInput = {
        companyId: query.companyId,
        ...(query.queueId && { queueId: query.queueId }),
        ...((query.startDate || query.endDate) && {
            enteredAt: {
                ...(query.startDate && { gte: new Date(`${query.startDate}T00:00:00.000Z`) }),
                ...(query.endDate && { lte: new Date(`${query.endDate}T23:59:59.999Z`) }),
            },
        }),
    }

    const [offered, answered, abandoned, slaCompliant, waitAgg, talkAgg, byAgentRaw, medianRows] = await Promise.all([
        prisma.queueCall.count({ where }),
        prisma.queueCall.count({ where: { ...where, outcome: 'answered' } }),
        prisma.queueCall.count({ where: { ...where, outcome: 'abandoned' } }),
        prisma.queueCall.count({ where: { ...where, outcome: 'answered', waitSeconds: { lte: query.slaSeconds } } }),
        prisma.queueCall.aggregate({ where: { ...where, waitSeconds: { not: null } }, _avg: { waitSeconds: true } }),
        prisma.queueCall.aggregate({ where: { ...where, outcome: 'answered', talkSeconds: { not: null } }, _avg: { talkSeconds: true } }),
        prisma.queueCall.groupBy({
            by: ['agentExtensionId'],
            where: { ...where, agentExtensionId: { not: null } },
            _count: { _all: true },
            _avg: { talkSeconds: true },
        }),
        // Prisma não tem percentile_cont nativo - mediana via raw query, mesmo where aplicado manualmente
        prisma.$queryRaw<Array<{ median: number | null }>>(Prisma.sql`
            SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY "waitSeconds") AS median
            FROM "queue_calls"
            WHERE "companyId" = ${query.companyId}
                ${query.queueId ? Prisma.sql`AND "queueId" = ${query.queueId}` : Prisma.empty}
                ${query.startDate ? Prisma.sql`AND "enteredAt" >= ${new Date(`${query.startDate}T00:00:00.000Z`)}` : Prisma.empty}
                ${query.endDate ? Prisma.sql`AND "enteredAt" <= ${new Date(`${query.endDate}T23:59:59.999Z`)}` : Prisma.empty}
                AND "waitSeconds" IS NOT NULL
        `),
    ])

    return {
        metrics: {
            offered,
            answered,
            abandoned,
            abandonRate: offered > 0 ? abandoned / offered : 0,
            slaSeconds: query.slaSeconds,
            slaCompliant,
            slaRate: answered > 0 ? slaCompliant / answered : 0,
            avgWaitSeconds: waitAgg._avg.waitSeconds,
            medianWaitSeconds: medianRows[0]?.median ?? null,
            avgTalkSeconds: talkAgg._avg.talkSeconds,
            byAgent: byAgentRaw.map((r) => ({
                agentExtensionId: r.agentExtensionId!,
                calls: r._count._all,
                avgTalkSeconds: r._avg.talkSeconds,
            })),
        },
    }
}

// --- Persistência via AMI/AGI (sem HTTP, chamado direto em processo de ami-events.ts/agi-server.ts) ---

async function resolveQueueContext(asteriskQueueName: string): Promise<{ companyId: string; queueId: string | null } | null> {
    const parsed = parseAsteriskQueueName(asteriskQueueName)
    if (!parsed) return null

    const company = await prisma.company.findUnique({ where: { asteriskId: parsed.asteriskId }, select: { id: true } })
    if (!company) return null

    const queue = await prisma.queue.findUnique({
        where: { number_companyId: { number: parsed.queueNumber, companyId: company.id } },
        select: { id: true },
    })
    return { companyId: company.id, queueId: queue?.id ?? null }
}

type JoinInput = { queueName: string; callerUniqueid: string; linkedid?: string | null; src?: string | null; position?: number | null }

export async function recordJoin(input: JoinInput): Promise<void> {
    try {
        const ctx = await resolveQueueContext(input.queueName)
        if (!ctx) return

        await prisma.queueCall.upsert({
            where: { callerUniqueid_queueName: { callerUniqueid: input.callerUniqueid, queueName: input.queueName } },
            create: {
                companyId: ctx.companyId,
                queueId: ctx.queueId,
                queueName: input.queueName,
                callerUniqueid: input.callerUniqueid,
                linkedid: input.linkedid ?? null,
                src: input.src ?? null,
                initialPosition: input.position ?? null,
            },
            // replay de AMI (reconexão) não deve resetar enteredAt/initialPosition já gravados
            update: {},
        })
    } catch (error) {
        logger.warn({ event: 'queue-calls.record_join.failed', queueName: input.queueName, message: error instanceof Error ? error.message : String(error) })
    }
}

type AgentConnectInput = { queueName: string; callerUniqueid: string; agentInterface: string; holdTimeSeconds?: number | null }

export async function recordAgentConnect(input: AgentConnectInput): Promise<void> {
    try {
        const parsed = parseMemberInterface(input.agentInterface)
        const agentExtensionId = parsed
            ? (await prisma.extension.findUnique({ where: { number: parsed.number }, select: { id: true } }))?.id ?? null
            : null

        await prisma.queueCall.updateMany({
            where: { callerUniqueid: input.callerUniqueid, queueName: input.queueName, connectedAt: null },
            data: {
                connectedAt: new Date(),
                waitSeconds: input.holdTimeSeconds ?? null,
                agentInterface: input.agentInterface,
                agentExtensionId,
            },
        })
    } catch (error) {
        logger.warn({ event: 'queue-calls.record_agent_connect.failed', queueName: input.queueName, message: error instanceof Error ? error.message : String(error) })
    }
}

type AnsweredInput = { queueName: string; callerUniqueid: string; talkTimeSeconds?: number | null; reason?: string | null }

export async function recordAnswered(input: AnsweredInput): Promise<void> {
    try {
        await prisma.queueCall.updateMany({
            where: { callerUniqueid: input.callerUniqueid, queueName: input.queueName, endedAt: null },
            data: {
                endedAt: new Date(),
                outcome: 'answered',
                talkSeconds: input.talkTimeSeconds ?? null,
                exitReason: input.reason ?? null,
            },
        })
    } catch (error) {
        logger.warn({ event: 'queue-calls.record_answered.failed', queueName: input.queueName, message: error instanceof Error ? error.message : String(error) })
    }
}

type AbandonedInput = { queueName: string; callerUniqueid: string; holdTimeSeconds?: number | null; position?: number | null }

export async function recordAbandoned(input: AbandonedInput): Promise<void> {
    try {
        await prisma.queueCall.updateMany({
            where: { callerUniqueid: input.callerUniqueid, queueName: input.queueName, endedAt: null },
            data: {
                endedAt: new Date(),
                outcome: 'abandoned',
                waitSeconds: input.holdTimeSeconds ?? null,
                finalPosition: input.position ?? null,
            },
        })
    } catch (error) {
        logger.warn({ event: 'queue-calls.record_abandoned.failed', queueName: input.queueName, message: error instanceof Error ? error.message : String(error) })
    }
}

// QUEUESTATUS setado nativamente pelo Queue() quando ele RETORNA pra próxima priority - só
// acontece quando o canal do ligante sobrevive (timeout/sem agente/fila cheia). Abandono e
// atendimento (ligante desliga ou agente desliga) já finalizam a linha via AMI antes disso, daí
// o guard endedAt:null pra não sobrescrever um outcome já correto.
const QUEUE_STATUS_OUTCOME: Record<string, string> = {
    TIMEOUT: 'timeout',
    FULL: 'empty',
    JOINEMPTY: 'empty',
    JOINUNAVAIL: 'empty',
    LEAVEEMPTY: 'empty',
    LEAVEUNAVAIL: 'empty',
}

export async function finalizeByQueueStatus(input: { queueId: string; callerUniqueid: string; queueStatus: string }): Promise<void> {
    if (!input.queueStatus) return
    try {
        const queue = await prisma.queue.findUnique({ where: { id: input.queueId }, select: { companyId: true, number: true } })
        if (!queue?.number) return
        const company = await prisma.company.findUnique({ where: { id: queue.companyId }, select: { asteriskId: true } })
        if (!company) return
        const queueName = `${company.asteriskId}-${queue.number}`

        const outcome = QUEUE_STATUS_OUTCOME[input.queueStatus] ?? 'failed'
        await prisma.queueCall.updateMany({
            where: { callerUniqueid: input.callerUniqueid, queueName, endedAt: null },
            data: { endedAt: new Date(), outcome },
        })
    } catch (error) {
        logger.warn({ event: 'queue-calls.finalize_by_queue_status.failed', queueId: input.queueId, message: error instanceof Error ? error.message : String(error) })
    }
}
