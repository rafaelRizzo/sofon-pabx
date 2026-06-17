import type { FastifyInstance } from 'fastify'
import * as UsersController from './users.controller'
import { protectedRoute, requireAdmin } from '../../middleware/scope.middleware'

export const usersRoutes = async (app: FastifyInstance) => {
    app.get('/users', { onRequest: [...protectedRoute, requireAdmin] }, UsersController.getAllUsers)
    app.get('/users/:id', { onRequest: protectedRoute }, UsersController.getUserById)
    app.get('/users/:id/companies', { onRequest: protectedRoute }, UsersController.getCompaniesByUser)
    app.post('/users', { onRequest: [...protectedRoute, requireAdmin] }, UsersController.createUser)
    app.put('/users/:id', { onRequest: protectedRoute }, UsersController.updateUser)
    app.delete('/users/:id', { onRequest: [...protectedRoute, requireAdmin] }, UsersController.deleteUser)
}
