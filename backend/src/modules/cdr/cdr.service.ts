import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { formatNaiveLocalISOString } from '../../utils/timezone'
import { AppError } from '../../utils/errors/app.error'
import { toAsteriskQueueName } from '../../asterisk/queue.repository'
import { enrichCdrRecords } from './cdr-enrichment'
import type { CdrExportQueryInput, CdrMetricsQueryInput, CdrQueryInput } from './schemas/cdr.schema'
import type { CompanyDto } from '../companies/companies.service'

// timezone do SO onde o Asterisk roda (setups/install-asterisk.sh) — ver comentário em schema.prisma no model cdr
const TZ = process.env.TZ || 'America/Sao_Paulo'

// queueId é friendly-facing (o front não sabe o formato interno "<asteriskId>-<number>" do
// queue_name gravado pelo dialplan) — resolve pro nome real antes de montar o where. 404 se o id
// não existir ou for de outra empresa, mesmo padrão de validação de posse usado em outros filtros
async function resolveQueueNameFilter(
    company: { id: string; asteriskId: string },
    queueId: string | undefined
): Promise<string | undefined> {
    if (!queueId) return undefined
    const queue = await prisma.queue.findFirst({
        where: { id: queueId, companyId: company.id },
        select: { number: true }
    })
    if (!queue) throw new AppError('Queue not found', 404)
    return toAsteriskQueueName(company.asteriskId, queue.number)
}

const buildWhere = async (company: { id: string; asteriskId: string }, query: CdrMetricsQueryInput) => {
    const queueNameFromId = await resolveQueueNameFilter(company, query.queueId)

    return {
        accountcode: company.asteriskId,
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
        ...((queueNameFromId ?? query.queueName) && { queueName: queueNameFromId ?? query.queueName }),
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
    }
}

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
    const where = await buildWhere(company, query)

    const [rows, total] = await Promise.all([
        prisma.cdr.findMany({
            where,
            orderBy: [{ startTime: query.order }, { id: query.order }],
            take: query.limit,
            skip: (query.page - 1) * query.limit,
            select
        }),
        prisma.cdr.count({ where })
    ])

    const records = await enrichCdrRecords(
        rows.map(({ disposition, ...r }) => ({
            ...r,
            id: r.id.toString(),
            callStatus: disposition,
            startTime:
                r.startTime && formatNaiveLocalISOString(r.startTime, TZ),
            answerTime:
                r.answerTime && formatNaiveLocalISOString(r.answerTime, TZ),
            endTime: r.endTime && formatNaiveLocalISOString(r.endTime, TZ)
        })),
        company
    )

    return {
        records,
        total,
        limit: query.limit,
        page: query.page
    }
}

const EXPORT_BATCH_SIZE = 500

// Company já resolvida (e posse validada) pelo controller antes de abrir o stream — 404 precisa
// acontecer antes do primeiro byte da resposta ser escrito, nunca no meio de um generator já
// consumido pelo Readable
export async function* iterateCdrExportRecords(
    company: Pick<CompanyDto, 'id' | 'asteriskId'>,
    query: CdrExportQueryInput
) {
    const where = await buildWhere(company, query)
    let skip = 0
    for (;;) {
        const rows = await prisma.cdr.findMany({
            where,
            orderBy: [{ startTime: query.order }, { id: query.order }],
            take: EXPORT_BATCH_SIZE,
            skip,
            select
        })
        if (rows.length === 0) break

        const trunkIds = [
            ...new Set(rows.map((r) => r.trunkId).filter((t): t is string => !!t))
        ]
        const trunks = trunkIds.length
            ? await prisma.trunk.findMany({
                  where: { id: { in: trunkIds } },
                  select: { id: true, name: true }
              })
            : []
        const trunkNameById = new Map(trunks.map((t) => [t.id, t.name]))

        const enriched = await enrichCdrRecords(
            rows.map(({ disposition, ...r }) => ({
                ...r,
                id: r.id.toString(),
                callStatus: disposition,
                startTime:
                    r.startTime && formatNaiveLocalISOString(r.startTime, TZ),
                answerTime:
                    r.answerTime && formatNaiveLocalISOString(r.answerTime, TZ),
                endTime: r.endTime && formatNaiveLocalISOString(r.endTime, TZ)
            })),
            company
        )

        yield enriched.map((r) => ({
            ...r,
            trunkName: r.trunkId ? trunkNameById.get(r.trunkId) ?? r.trunkId : null
        }))

        if (rows.length < EXPORT_BATCH_SIZE) break
        skip += EXPORT_BATCH_SIZE
    }
}

export const getCdrMetricsByCompany = async (query: CdrMetricsQueryInput) => {
    const company = await getCompanyById(query.companyId)
    const where = await buildWhere(company, query)

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

// Não vaza existência de registro de outra empresa: qualquer descasamento (não achou, sem
// gravação, accountcode de empresa diferente) devolve o mesmo 404 genérico
export const getCdrRecordingPath = async (id: bigint, companyId: string) => {
    const company = await getCompanyById(companyId)
    const record = await prisma.cdr.findUnique({
        where: { id },
        select: { accountcode: true, recordingFile: true }
    })

    if (!record || !record.recordingFile || record.accountcode !== company.asteriskId) {
        throw new AppError('Recording not found', 404)
    }

    return record.recordingFile
}
