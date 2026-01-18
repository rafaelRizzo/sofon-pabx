import type { FastifyInstance } from 'fastify'
import { authMiddleware, adminMiddleware } from '../../middlewares/middleware.auth'
import {
    createExtensionSchema,
    updateExtensionSchema,
    getExtensionSchema,
    deleteExtensionSchema
} from './schema/extension.schema'
import { ExtensionController } from '../../controllers/extension/extension.controller'

export const extensionRoutes = async (fastify: FastifyInstance) => {
    const authAdmin = { preHandler: authMiddleware, adminMiddleware }

    fastify.post(
        '/extensions',
        { ...authAdmin, schema: createExtensionSchema },
        (request, reply) => new ExtensionController(request, reply).create()
    )

    fastify.get(
        '/extensions',
        { ...authAdmin },
        (request, reply) => new ExtensionController(request, reply).list()
    )

    fastify.get(
        '/extensions/:id',
        { ...authAdmin, schema: getExtensionSchema },
        (request, reply) => new ExtensionController(request, reply).getById()
    )

    fastify.put(
        '/extensions/:id',
        { ...authAdmin, schema: updateExtensionSchema },
        (request, reply) => new ExtensionController(request, reply).update()
    )

    fastify.delete(
        '/extensions/:id',
        { ...authAdmin, schema: deleteExtensionSchema },
        (request, reply) => new ExtensionController(request, reply).delete()
    )
}