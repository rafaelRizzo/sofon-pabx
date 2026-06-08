import type { FastifyInstance } from 'fastify'
import * as AuthController from './auth.controller'
import { authMiddleware } from '../../middleware/auth.middleware'

export const authRoutes = async (app: FastifyInstance) => {
    app.post('/auth/register', AuthController.register)
    app.post('/auth/login', AuthController.login)
    app.post('/auth/refresh', AuthController.refresh)
    app.post('/auth/logout', { onRequest: authMiddleware }, AuthController.logout)
}
