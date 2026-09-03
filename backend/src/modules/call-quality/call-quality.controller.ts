import type { FastifyRequest, FastifyReply } from 'fastify'
import * as Service from './call-quality.service'
import { callQualityQuerySchema, callQualitySummaryQuerySchema } from './schemas/call-quality.schema'
import { handleError } from '../../utils/errors/handler.error'

export const getCallQuality = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const query = callQualityQuerySchema.parse(req.query)
        req.scope.assertAccess(query.companyId)
        return reply.send({ success: true, ...(await Service.getCallQualityList(query)) })
    } catch (e) {
        return handleError(reply, e, req)
    }
}

export const getCallQualitySummary = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const query = callQualitySummaryQuerySchema.parse(req.query)
        req.scope.assertAccess(query.companyId)
        return reply.send({ success: true, ...(await Service.getCallQualitySummary(query)) })
    } catch (e) {
        return handleError(reply, e, req)
    }
}
