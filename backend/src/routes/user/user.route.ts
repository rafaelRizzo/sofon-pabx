import { type FastifyInstance } from 'fastify'
import { authMiddleware, adminMiddleware } from '../../middlewares/middleware.auth'
import { createUserSchema, updateUserSchema, getUserSchema, deleteUserSchema } from './schema/user.schema'
import { createUser, deleteUser, firstUser, getUser, listUsers, updateUser } from '../../controllers/user/user.controller'

export const userRoutes = async (fastify: FastifyInstance) => {
    const authAdmin = { preHandler: authMiddleware, adminMiddleware }

    fastify.post('/first-user', { schema: createUserSchema }, firstUser)
    fastify.post('/users', { ...authAdmin, schema: createUserSchema }, createUser)
    fastify.get('/users', authAdmin, listUsers)
    fastify.get('/users/:id', { ...authAdmin, schema: getUserSchema }, getUser)
    fastify.put('/users/:id', { ...authAdmin, schema: updateUserSchema }, updateUser)
    fastify.delete('/users/:id', { ...authAdmin, schema: deleteUserSchema }, deleteUser)
}