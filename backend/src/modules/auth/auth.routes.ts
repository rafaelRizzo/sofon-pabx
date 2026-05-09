import { type FastifyInstance } from 'fastify'
import * as AuthController from './auth.controller'

export async function authRoutes(app: FastifyInstance) {
    app.post('/login', AuthController.authUser)
    app.post('/refresh', AuthController.refresh)
    app.post('/logout', AuthController.logout)
}