import { prisma } from '../../lib/prisma'
import { AppError } from '../../utils/errors/app.error'
import type { CdrQueryInput } from './schemas/cdr.schema'

export const getCdrByCompany = async (query: CdrQueryInput) => {
    const company = await prisma.company.findUnique({
        where: { id: query.companyId },
        select: { asteriskId: true },
    })
    if (!company) throw new AppError('Company not found', 404)

    const where = {
        accountcode: company.asteriskId,
        ...(query.src && { src: { contains: query.src } }),
        ...(query.dst && { dst: { contains: query.dst } }),
        ...(query.disposition && { disposition: query.disposition }),
        ...((query.startDate || query.endDate) && {
            startTime: {
                ...(query.startDate && { gte: new Date(query.startDate) }),
                ...(query.endDate && { lte: new Date(query.endDate) }),
            },
        }),
    }

    const [rows, total] = await Promise.all([
        prisma.cdr.findMany({
            where,
            orderBy: { startTime: 'desc' },
            take: query.limit,
            skip: query.offset,
            select: {
                id: true, src: true, dst: true, context: true, callerid: true,
                srcChannel: true, dstChannel: true, lastApp: true, lastData: true,
                startTime: true, answerTime: true, endTime: true, duration: true,
                billsec: true, disposition: true, uniqueid: true,
            },
        }),
        prisma.cdr.count({ where }),
    ])

    return {
        records: rows.map((r) => ({ ...r, id: r.id.toString() })),
        total,
        limit: query.limit,
        offset: query.offset,
    }
}
