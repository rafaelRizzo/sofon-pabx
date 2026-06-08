import type { FastifyInstance } from 'fastify'
import * as UsersController from './users.controller'
import { authMiddleware } from '../../middleware/auth.middleware'

export const usersRoutes = async (app: FastifyInstance) => {
    app.get('/users', { onRequest: authMiddleware }, UsersController.getAllUsers)
    app.get('/users/:id', { onRequest: authMiddleware }, UsersController.getUserById)
    app.get('/users/:id/companies', { onRequest: authMiddleware }, UsersController.getCompaniesByUser)
    app.post('/users', { onRequest: authMiddleware }, UsersController.createUser)
    app.put('/users/:id', { onRequest: authMiddleware }, UsersController.updateUser)
    app.delete('/users/:id', { onRequest: authMiddleware }, UsersController.deleteUser)
}
