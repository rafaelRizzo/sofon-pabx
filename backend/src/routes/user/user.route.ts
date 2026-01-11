import type { FastifyInstance } from 'fastify'
import { authMiddleware, adminMiddleware } from '../../middlewares/middleware.auth'
import {
    createUserSchema,
    updateUserSchema,
    getUserSchema,
    deleteUserSchema
} from './schema/user.schema'
import { UserController } from '../../controllers/user/user.controller'

export const userRoutes = async (fastify: FastifyInstance) => {
    const authAdmin = { preHandler: authMiddleware, adminMiddleware }

    fastify.post(
        '/first-user',
        { schema: createUserSchema },
        (request, reply) => new UserController(request, reply).createFirstUser()
    )

    fastify.post(
        '/users',
        { ...authAdmin, schema: createUserSchema },
        (request, reply) => new UserController(request, reply).create()
    )

    fastify.get(
        '/users',
        authAdmin,
        (request, reply) => new UserController(request, reply).list()
    )

    fastify.get(
        '/users/:id',
        { ...authAdmin, schema: getUserSchema },
        (request, reply) => new UserController(request, reply).getById()
    )

    fastify.put(
        '/users/:id',
        { ...authAdmin, schema: updateUserSchema },
        (request, reply) => new UserController(request, reply).update()
    )

    fastify.delete(
        '/users/:id',
        { ...authAdmin, schema: deleteUserSchema },
        (request, reply) => new UserController(request, reply).delete()
    )
}
