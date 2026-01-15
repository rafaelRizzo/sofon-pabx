import type { FastifyInstance } from 'fastify'
import { authMiddleware, adminMiddleware } from '../../middlewares/middleware.auth'
import {
    createIVROptionSchema,
    getIVROptionSchema,
    updateIVROptionSchema,
    deleteIVROptionSchema
} from './schema/ivrOption.schema'
import { IVROptionController } from '../../controllers/ivrOption/ivrOption.controller'

export const ivrOptionRoutes = async (fastify: FastifyInstance) => {
    const authAdmin = { preHandler: authMiddleware, adminMiddleware }

    fastify.post(
        '/ivr-options',
        { ...authAdmin, schema: createIVROptionSchema },
        (request, reply) => new IVROptionController(request, reply).create()
    )

    fastify.get(
        '/ivr-options',
        authAdmin,
        (request, reply) => new IVROptionController(request, reply).list()
    )

    fastify.get(
        '/ivr-options/:id',
        { ...authAdmin, schema: getIVROptionSchema },
        (request, reply) => new IVROptionController(request, reply).getById()
    )

    fastify.put(
        '/ivr-options/:id',
        { ...authAdmin, schema: updateIVROptionSchema },
        (request, reply) => new IVROptionController(request, reply).update()
    )

    fastify.delete(
        '/ivr-options/:id',
        { ...authAdmin, schema: deleteIVROptionSchema },
        (request, reply) => new IVROptionController(request, reply).delete()
    )
}
