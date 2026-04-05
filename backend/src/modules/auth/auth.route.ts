import { type FastifyInstance } from 'fastify'
import * as AuthController from './auth.controller'

export async function authRoutes(app: FastifyInstance) {
    app.post('/login', AuthController.authUser)
}