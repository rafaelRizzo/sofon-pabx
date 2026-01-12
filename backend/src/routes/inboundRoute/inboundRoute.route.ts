import type { FastifyInstance } from 'fastify'
import { authMiddleware, adminMiddleware } from '../../middlewares/middleware.auth'
import {
    createInboundRouteSchema,
    getInboundRouteSchema,
    updateInboundRouteSchema,
    deleteInboundRouteSchema
} from './schema/inboundRoute.schema'
import { InboundRouteController } from '../../controllers/inboundRoute/inboundRoute.controller'

export const inboundRouteRoutes = async (fastify: FastifyInstance) => {
    const authAdmin = { preHandler: authMiddleware, adminMiddleware }

    fastify.post(
        '/inbound-route',
        { ...authAdmin, schema: createInboundRouteSchema },
        (request, reply) => new InboundRouteController(request, reply).create()
    )

    fastify.get(
        '/inbound-route',
        authAdmin,
        (request, reply) => new InboundRouteController(request, reply).list()
    )

    fastify.get(
        '/inbound-route/:id',
        { ...authAdmin, schema: getInboundRouteSchema },
        (request, reply) => new InboundRouteController(request, reply).getById()
    )

    fastify.put(
        '/inbound-route/:id',
        { ...authAdmin, schema: updateInboundRouteSchema },
        (request, reply) => new InboundRouteController(request, reply).update()
    )

    fastify.delete(
        '/inbound-route/:id',
        { ...authAdmin, schema: deleteInboundRouteSchema },
        (request, reply) => new InboundRouteController(request, reply).delete()
    )
}
