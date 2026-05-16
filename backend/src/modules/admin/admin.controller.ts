import type { FastifyRequest, FastifyReply } from 'fastify'
import { cacheManager } from '../../utils/cache/cache.manager'
import { getLoggedUser } from '../../utils/handlers/handler.req.user'
import { handleError } from '../../utils/handlers/handler.errors'

export const flushCache = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { role } = getLoggedUser(req)

        if (role !== 'admin') {
            return reply.status(403).send({
                success: false,
                message: 'Only admins can flush cache'
            })
        }

        await cacheManager.flush()

        return reply.send({
            success: true,
            message: 'Cache flushed successfully'
        })
    } catch (error) {
        return handleError(reply, error)
    }
}
