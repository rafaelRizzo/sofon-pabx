import type { FastifyInstance } from 'fastify'
import { authMiddleware, adminMiddleware } from '../../middlewares/middleware.auth'
import {
    createIVRSchema,
    getIVRSchema,
    updateIVRSchema,
    deleteIVRSchema
} from './schema/ivr.schema'
import { IVRController } from '../../controllers/ivr/ivr.controller'

export const ivrRoutes = async (fastify: FastifyInstance) => {
    const authAdmin = { preHandler: authMiddleware, adminMiddleware }

    fastify.post(
        '/ivrs',
        { ...authAdmin, schema: createIVRSchema },
        (request, reply) => new IVRController(request, reply).create()
    )

    fastify.get(
        '/ivrs',
        authAdmin,
        (request, reply) => new IVRController(request, reply).list()
    )

    fastify.get(
        '/ivrs/:id',
        { ...authAdmin, schema: getIVRSchema },
        (request, reply) => new IVRController(request, reply).getById()
    )

    fastify.put(
        '/ivrs/:id',
        { ...authAdmin, schema: updateIVRSchema },
        (request, reply) => new IVRController(request, reply).update()
    )

    fastify.delete(
        '/ivrs/:id',
        { ...authAdmin, schema: deleteIVRSchema },
        (request, reply) => new IVRController(request, reply).delete()
    )
}
