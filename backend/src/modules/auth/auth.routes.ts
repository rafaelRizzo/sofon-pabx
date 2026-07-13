import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as AuthController from './auth.controller'
import { authMiddleware } from '../../middleware/auth.middleware'
import { loginSchema, TokenResponse, LogoutResponse, MeResponse } from './schemas/auth.schema'
import { createUserSchema } from '../users/schemas/user.schema'
import { errors } from '../../schemas/responses'

// Throttle agressivo em auth: barra brute-force/credential-stuffing (o rate limit global de 1000/s
// é frouxo demais pra endpoints de credencial).
const authRateLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }

export const authRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.post('/auth/register', {
        ...authRateLimit,
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
        ...authRateLimit,
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
        ...authRateLimit,
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

    router.get('/auth/me', {
        onRequest: authMiddleware,
        schema: {
            tags: ['Auth'],
            summary: 'Usuário logado',
            description: 'Dados do usuário do token atual, incluindo role e permissions.',
            security: [{ bearerAuth: [] }],
            response: {
                200: MeResponse,
                401: errors[401],
                404: errors[404],
            },
        },
    }, AuthController.me as any)

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
