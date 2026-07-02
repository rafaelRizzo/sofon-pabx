import type { FastifyRequest, FastifyReply } from 'fastify'
import * as Service from './cdr.service'
import { cdrQuerySchema } from './schemas/cdr.schema'
import { handleError } from '../../utils/errors/handler.error'

export const getCdr = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const query = cdrQuerySchema.parse(req.query)
        req.scope.assertAccess(query.companyId)
        return reply.send({ success: true, ...(await Service.getCdrByCompany(query)) })
    } catch (e) { return handleError(reply, e, req) }
}
