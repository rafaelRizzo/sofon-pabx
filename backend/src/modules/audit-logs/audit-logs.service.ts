import { prisma } from '../../lib/prisma'
import type { AuditLogQueryInput } from './schemas/audit-log.schema'

const buildWhere = (query: AuditLogQueryInput, companyIds: string[] | null) => ({
    // query.companyId já foi validado contra companyIds em listAuditLogs - pode sobrepor o `in`
    ...(query.companyId ? { companyId: query.companyId } : companyIds ? { companyId: { in: companyIds } } : {}),
    ...(query.actorId && { actorId: query.actorId }),
    ...(query.model && { model: query.model }),
    ...(query.recordId && { recordId: query.recordId }),
    ...(query.action && { action: query.action }),
    ...((query.startDate || query.endDate) && {
        createdAt: {
            ...(query.startDate && { gte: new Date(`${query.startDate}T00:00:00.000Z`) }),
            ...(query.endDate && { lte: new Date(`${query.endDate}T23:59:59.999Z`) }),
        },
    }),
})

// companyIds: null pra admin (sem restrição); array pro resto (só empresas do escopo, mesmo
// quando query.companyId já filtra uma delas - evita vazar auditoria de empresa fora do escopo)
export const listAuditLogs = async (query: AuditLogQueryInput, companyIds: string[] | null) => {
    if (companyIds) {
        if (query.companyId && !companyIds.includes(query.companyId)) {
            return { records: [], total: 0, limit: query.limit, page: query.page }
        }
        if (companyIds.length === 0) {
            return { records: [], total: 0, limit: query.limit, page: query.page }
        }
    }

    const where = buildWhere(query, companyIds)

    const [records, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: query.order },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
        }),
        prisma.auditLog.count({ where }),
    ])

    return { records, total, limit: query.limit, page: query.page }
}
