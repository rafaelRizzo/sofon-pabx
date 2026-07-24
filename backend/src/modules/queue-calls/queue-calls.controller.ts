import type { FastifyRequest, FastifyReply } from 'fastify'
import * as QueueCallsService from './queue-calls.service'
import { queueCallQuerySchema, queueCallMetricsQuerySchema } from './schemas/queue-call.schema'
import { handleError } from '../../utils/errors/handler.error'

export const getQueueCalls = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const query = queueCallQuerySchema.parse(req.query)
        req.scope.assertAccess(query.companyId)
        return reply.send({ success: true, ...(await QueueCallsService.listQueueCalls(query)) })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getQueueCallMetrics = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const query = queueCallMetricsQuerySchema.parse(req.query)
        req.scope.assertAccess(query.companyId)
        return reply.send({ success: true, ...(await QueueCallsService.getQueueCallMetrics(query)) })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
