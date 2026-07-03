import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { formatNaiveLocalISOString } from '../../utils/timezone'
import type { CdrQueryInput } from './schemas/cdr.schema'

// timezone do SO onde o Asterisk roda (setups/install-asterisk.sh) — ver comentário em schema.prisma no model cdr
const TZ = process.env.TZ || 'America/Sao_Paulo'

export const getCdrByCompany = async (query: CdrQueryInput) => {
    const company = await getCompanyById(query.companyId)

    const where = {
        accountcode: company.asteriskId,
        ...(query.src && { src: { contains: query.src } }),
        ...(query.dst && { dst: { contains: query.dst } }),
        ...(query.callStatus && { disposition: query.callStatus }),
        // startDate/endDate são datas soltas (YYYY-MM-DD) — cobrem o dia inteiro, 00:00:00 a 23:59:59.999.
        // Sem conversão de timezone: a coluna já guarda dígitos naive na hora local do servidor (ver schema.prisma),
        // e a data recebida já representa esse mesmo dia local, então os dígitos batem 1:1.
        ...((query.startDate || query.endDate) && {
            startTime: {
                ...(query.startDate && { gte: new Date(`${query.startDate}T00:00:00.000Z`) }),
                ...(query.endDate && { lte: new Date(`${query.endDate}T23:59:59.999Z`) }),
            },
        }),
    }

    const [rows, total] = await Promise.all([
        prisma.cdr.findMany({
            where,
            orderBy: [{ startTime: query.order }, { id: query.order }],
            take: query.limit,
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
        records: rows.map(({ disposition, ...r }) => ({
            ...r,
            id: r.id.toString(),
            callStatus: disposition,
            startTime: r.startTime && formatNaiveLocalISOString(r.startTime, TZ),
            answerTime: r.answerTime && formatNaiveLocalISOString(r.answerTime, TZ),
            endTime: r.endTime && formatNaiveLocalISOString(r.endTime, TZ),
        })),
        total,
        limit: query.limit,
    }
}
