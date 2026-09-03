import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import type { CallQualityQueryInput, CallQualitySummaryQueryInput } from './schemas/call-quality.schema'

export type RecordCallQualityInput = {
    companyId: string
    trunkId: string
    uniqueid: string
    linkedid: string | null
    callerNum: string | null
    channel: string
    startAt: Date
    endAt: Date
    avgRxJitterUnits: number | null
    avgRxLostPct: number | null
    rxSamples: number
    avgTxJitterUnits: number | null
    avgTxLostPct: number | null
    txSamples: number
    avgRttSeconds: number | null
    rttSamples: number
}

// Chamado pelo handleHangup (ami-events.ts) - fora do request/response HTTP, sem controller.
// uniqueid é @unique no schema: um Hangup duplicado (reconexão do AMI reprocessando o mesmo
// evento) vira erro de constraint, não um registro duplicado - deixa o chamador decidir se ignora.
export const recordCallQuality = (data: RecordCallQualityInput) => prisma.callQuality.create({ data })

// companyId é FK direta aqui (não accountcode como no CDR) - filtro simples, sem resolver nome de fila/tronco
const buildWhereByCompany = (companyId: string, query: CallQualitySummaryQueryInput) => ({
    companyId,
    ...(query.trunkId && { trunkId: query.trunkId }),
    // startDate/endDate são datas soltas (YYYY-MM-DD), cobrindo o dia inteiro em UTC - startAt é
    // um DateTime real (@db.Timestamptz não setado aqui de propósito, ver schema: gravado como
    // Date.now() do processo Node, já em UTC) - sem a mesma pegadinha naive-local do CDR nativo.
    ...((query.startDate || query.endDate) && {
        startAt: {
            ...(query.startDate && { gte: new Date(`${query.startDate}T00:00:00.000Z`) }),
            ...(query.endDate && { lte: new Date(`${query.endDate}T23:59:59.999Z`) }),
        },
    }),
})

export const getCallQualityList = async (query: CallQualityQueryInput) => {
    const company = await getCompanyById(query.companyId)
    const where = buildWhereByCompany(company.id, query)

    const [rows, total] = await Promise.all([
        prisma.callQuality.findMany({
            where,
            orderBy: [{ startAt: query.order }, { id: query.order }],
            take: query.limit,
            skip: (query.page - 1) * query.limit,
            include: { trunk: { select: { name: true } } },
        }),
        prisma.callQuality.count({ where }),
    ])

    return {
        records: rows.map(({ trunk, ...r }) => ({ ...r, trunkName: trunk.name })),
        total,
        limit: query.limit,
        page: query.page,
    }
}

export const getCallQualitySummary = async (query: CallQualitySummaryQueryInput) => {
    const company = await getCompanyById(query.companyId)
    const where = buildWhereByCompany(company.id, query)

    const [totalCalls, aggregate] = await Promise.all([
        prisma.callQuality.count({ where }),
        prisma.callQuality.aggregate({
            where,
            _avg: {
                avgRxJitterUnits: true,
                avgRxLostPct: true,
                avgTxJitterUnits: true,
                avgTxLostPct: true,
                avgRttSeconds: true,
            },
        }),
    ])

    return {
        summary: {
            totalCalls,
            avgRxJitterUnits: aggregate._avg.avgRxJitterUnits,
            avgRxLostPct: aggregate._avg.avgRxLostPct,
            avgTxJitterUnits: aggregate._avg.avgTxJitterUnits,
            avgTxLostPct: aggregate._avg.avgTxLostPct,
            avgRttSeconds: aggregate._avg.avgRttSeconds,
        },
    }
}
