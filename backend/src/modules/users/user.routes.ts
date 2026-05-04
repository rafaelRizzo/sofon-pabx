import { type FastifyInstance } from 'fastify'
import * as UserController from './user.controller'
import { verifyAdmin, verifyToken } from '../../middlewares/auth.middleware'

export async function userRoutes(app: FastifyInstance) {
    app.post('/first-user', UserController.createFirstUser)
    app.post('/users', { preHandler: verifyAdmin }, UserController.createUser)
    app.get('/users', { preHandler: verifyAdmin }, UserController.getUsers)
    app.get('/users/:id', { preHandler: verifyToken }, UserController.getUserById)
    app.put('/users/:id', { preHandler: verifyToken }, UserController.updateUser)
    app.delete('/users/:id', { preHandler: verifyAdmin }, UserController.deleteUser)
}
