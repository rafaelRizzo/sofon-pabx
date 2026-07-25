import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { formatNaiveLocalISOString } from '../../utils/timezone'
import type { CdrMetricsQueryInput, CdrQueryInput } from './schemas/cdr.schema'

// timezone do SO onde o Asterisk roda (setups/install-asterisk.sh) — ver comentário em schema.prisma no model cdr
const TZ = process.env.TZ || 'America/Sao_Paulo'

const buildWhere = (asteriskId: string, query: CdrMetricsQueryInput) => ({
    accountcode: asteriskId,
    ...(query.src && { src: { contains: query.src } }),
    ...(query.dst && { dst: { contains: query.dst } }),
    ...(query.callStatus && { disposition: query.callStatus }),
    ...(query.direction && { direction: query.direction }),
    ...(query.originExtension && {
        originExtension: { contains: query.originExtension }
    }),
    ...(query.dialedNumber && {
        dialedNumber: { contains: query.dialedNumber }
    }),
    ...(query.trunkId && { trunkId: query.trunkId }),
    ...(query.queueName && { queueName: query.queueName }),
    ...(query.linkedid && { linkedid: query.linkedid }),
    ...(query.uniqueid && { uniqueid: query.uniqueid }),
    // startDate/endDate são datas soltas (YYYY-MM-DD) — cobrem o dia inteiro, 00:00:00 a 23:59:59.999.
    // Sem conversão de timezone: a coluna já guarda dígitos naive na hora local do servidor (ver schema.prisma),
    // e a data recebida já representa esse mesmo dia local, então os dígitos batem 1:1.
    ...((query.startDate || query.endDate) && {
        startTime: {
            ...(query.startDate && {
                gte: new Date(`${query.startDate}T00:00:00.000Z`)
            }),
            ...(query.endDate && {
                lte: new Date(`${query.endDate}T23:59:59.999Z`)
            })
        }
    })
})

const select = {
    id: true,
    src: true,
    dst: true,
    context: true,
    callerid: true,
    srcChannel: true,
    dstChannel: true,
    lastApp: true,
    lastData: true,
    startTime: true,
    answerTime: true,
    endTime: true,
    duration: true,
    billsec: true,
    disposition: true,
    uniqueid: true,
    queueName: true,
    linkedid: true,
    sequence: true,
    direction: true,
    originExtension: true,
    dialedNumber: true,
    trunkId: true,
    recordingFile: true,
    hangupCause: true
} as const

export const getCdrByCompany = async (query: CdrQueryInput) => {
    const company = await getCompanyById(query.companyId)
    const where = buildWhere(company.asteriskId, query)

    const [rows, total] = await Promise.all([
        prisma.cdr.findMany({
            where,
            orderBy: [{ startTime: query.order }, { id: query.order }],
            take: query.limit + 1,
            ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
            select
        }),
        prisma.cdr.count({ where })
    ])

    const hasMore = rows.length > query.limit
    const page = hasMore ? rows.slice(0, query.limit) : rows

    return {
        records: page.map(({ disposition, ...r }) => ({
            ...r,
            id: r.id.toString(),
            callStatus: disposition,
            startTime:
                r.startTime && formatNaiveLocalISOString(r.startTime, TZ),
            answerTime:
                r.answerTime && formatNaiveLocalISOString(r.answerTime, TZ),
            endTime: r.endTime && formatNaiveLocalISOString(r.endTime, TZ)
        })),
        total,
        limit: query.limit,
        nextCursor: hasMore ? page.at(-1)!.id.toString() : null
    }
}

export const getCdrMetricsByCompany = async (query: CdrMetricsQueryInput) => {
    const company = await getCompanyById(query.companyId)
    const where = buildWhere(company.asteriskId, query)

    const [total, answered, aggregate, byStatus, byDirection] =
        await Promise.all([
            prisma.cdr.count({ where }),
            prisma.cdr.count({ where: { ...where, disposition: 'ANSWERED' } }),
            prisma.cdr.aggregate({
                where,
                _sum: { duration: true, billsec: true },
                _avg: { duration: true, billsec: true }
            }),
            prisma.cdr.groupBy({
                by: ['disposition'],
                where,
                _count: { _all: true }
            }),
            prisma.cdr.groupBy({
                by: ['direction'],
                where,
                _count: { _all: true }
            })
        ])

    return {
        metrics: {
            total,
            answered,
            answerRate: total > 0 ? answered / total : 0,
            totalDuration: aggregate._sum.duration ?? 0,
            totalBillsec: aggregate._sum.billsec ?? 0,
            avgDuration: aggregate._avg.duration,
            avgBillsec: aggregate._avg.billsec,
            byStatus: byStatus.map((row) => ({
                callStatus: row.disposition,
                calls: row._count._all
            })),
            byDirection: byDirection.map((row) => ({
                direction: row.direction,
                calls: row._count._all
            }))
        }
    }
}
