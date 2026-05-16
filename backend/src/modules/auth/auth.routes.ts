import { type FastifyInstance } from 'fastify'
import * as AuthController from './auth.controller'

export const authRoutes = async (app: FastifyInstance) => {
    app.post('/login', AuthController.authUser)
    app.post('/refresh', AuthController.refresh)
    app.post('/logout', AuthController.logout)
}