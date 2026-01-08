import { type FastifyInstance } from 'fastify'
import { authMiddleware } from '../../middlewares/middleware.auth'
import { createUserSchema, updateUserSchema, getUserSchema, deleteUserSchema } from './schema/user.schema'
import { createUser, deleteUser, firstUser, getUser, listUsers, updateUser } from '../../controllers/user/user.controller'

export const userRoutes = async (fastify: FastifyInstance) => {
    const auth = { preHandler: authMiddleware }

    fastify.post('/first-user', { schema: createUserSchema }, firstUser)
    fastify.post('/users', { ...auth, schema: createUserSchema }, createUser)
    fastify.get('/users', auth, listUsers)
    fastify.get('/users/:id', { ...auth, schema: getUserSchema }, getUser)
    fastify.put('/users/:id', { ...auth, schema: updateUserSchema }, updateUser)
    fastify.delete('/users/:id', { ...auth, schema: deleteUserSchema }, deleteUser)
}