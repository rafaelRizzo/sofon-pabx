import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import * as RealtimeService from './realtime.service'
import { handleError } from '../../utils/errors/handler.error'
import { streamRealtimeStatus } from './realtime.sse'

const optionalCompanyQuery = z.object({ companyId: z.cuid2().optional() })

export const getExtensionsStatus = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const filter = optionalCompanyQuery.safeParse(req.query)
        if (filter.success && filter.data.companyId) {
            req.scope.assertAccess(filter.data.companyId)
            const extensions = await RealtimeService.getExtensionsStatus([filter.data.companyId])
            return reply.send({ success: true, message: 'Extensions status fetched successfully', extensions })
        }
        const extensions = await RealtimeService.getExtensionsStatus(req.scope.companyIds ?? undefined)
        return reply.send({ success: true, message: 'Extensions status fetched successfully', extensions })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getTrunksStatus = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const filter = optionalCompanyQuery.safeParse(req.query)
        if (filter.success && filter.data.companyId) {
            req.scope.assertAccess(filter.data.companyId)
            const trunks = await RealtimeService.getTrunksStatus([filter.data.companyId])
            return reply.send({ success: true, message: 'Trunks status fetched successfully', trunks })
        }
        const trunks = await RealtimeService.getTrunksStatus(req.scope.companyIds ?? undefined)
        return reply.send({ success: true, message: 'Trunks status fetched successfully', trunks })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getQueuesStatus = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const filter = optionalCompanyQuery.safeParse(req.query)
        if (filter.success && filter.data.companyId) {
            req.scope.assertAccess(filter.data.companyId)
            const queues = await RealtimeService.getQueuesStatus([filter.data.companyId])
            return reply.send({ success: true, message: 'Queues status fetched successfully', queues })
        }
        const queues = await RealtimeService.getQueuesStatus(req.scope.companyIds ?? undefined)
        return reply.send({ success: true, message: 'Queues status fetched successfully', queues })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const streamExtensionsStatus = (req: FastifyRequest, reply: FastifyReply) =>
    streamRealtimeStatus(req, reply, 'extension', RealtimeService.getExtensionsStatus)

export const streamTrunksStatus = (req: FastifyRequest, reply: FastifyReply) =>
    streamRealtimeStatus(req, reply, 'trunk', RealtimeService.getTrunksStatus)

export const streamQueuesStatus = (req: FastifyRequest, reply: FastifyReply) =>
    streamRealtimeStatus(req, reply, 'queue', RealtimeService.getQueuesStatus)
