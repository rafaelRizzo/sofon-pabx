import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as AuthController from './auth.controller'
import { authMiddleware } from '../../middleware/auth.middleware'
import { loginSchema, TokenResponse, LogoutResponse } from './schemas/auth.schema'
import { createUserSchema } from '../users/schemas/user.schema'
import { errors } from '../../schemas/responses'

export const authRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.post('/auth/register', {
        schema: {
            tags: ['Auth'],
            summary: 'Registrar primeiro usuário',
            description: 'Só funciona quando não existe nenhum usuário cadastrado. Cria automaticamente como admin.',
            body: createUserSchema,
            response: {
                201: TokenResponse,
                409: errors[409],
            },
        },
    }, AuthController.register as any)

    router.post('/auth/login', {
        schema: {
            tags: ['Auth'],
            summary: 'Login',
            description: 'Retorna accessToken + refreshToken.',
            body: loginSchema,
            response: {
                200: TokenResponse,
                401: errors[401],
            },
        },
    }, AuthController.login as any)

    router.post('/auth/refresh', {
        schema: {
            tags: ['Auth'],
            summary: 'Renovar access token',
            description: 'Recebe refreshToken, retorna novo accessToken.',
            response: {
                200: TokenResponse,
                401: errors[401],
            },
        },
    }, AuthController.refresh as any)

    router.post('/auth/logout', {
        onRequest: authMiddleware,
        schema: {
            tags: ['Auth'],
            summary: 'Logout',
            description: 'Revoga tokens via JTI no Redis.',
            security: [{ bearerAuth: [] }],
            response: {
                200: LogoutResponse,
                401: errors[401],
            },
        },
    }, AuthController.logout as any)
}
