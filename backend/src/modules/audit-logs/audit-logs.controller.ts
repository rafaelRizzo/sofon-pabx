import type { FastifyRequest, FastifyReply } from 'fastify'
import * as Service from './audit-logs.service'
import { auditLogQuerySchema } from './schemas/audit-log.schema'
import { handleError } from '../../utils/errors/handler.error'

export const getAuditLogs = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const query = auditLogQuerySchema.parse(req.query)
        const result = await Service.listAuditLogs(query, req.scope.companyIds)
        return reply.send({ success: true, ...result })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
