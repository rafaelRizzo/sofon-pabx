import type { FastifyRequest, FastifyReply } from 'fastify'
import { verifyToken } from '../lib/jwt'
import { jtiManager } from '../lib/jti'
import { AppError } from '../utils/errors/app.error'

export const authMiddleware = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const auth = req.headers.authorization
        const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null

        if (!token) {
            throw new AppError('Unauthorized', 401)
        }

        const decoded = verifyToken(token)

        // Defesa em profundidade: um refresh token nunca deve autenticar uma rota normal, mesmo
        // que JWT_SECRET/REFRESH_SECRET algum dia colidam (ex: erro de config/dev) - ver generateTokens.
        if (decoded.type !== 'access') {
            throw new AppError('Unauthorized', 401)
        }

        if (decoded.jti) {
            let jtiExists: boolean
            try {
                jtiExists = await jtiManager.exists(decoded.jti)
            } catch {
                // Redis fora do ar - não é o mesmo que "token revogado", não pode forçar logout
                throw new AppError('Auth service unavailable', 503)
            }
            if (!jtiExists) {
                throw new AppError('Token revoked', 401)
            }
        }

        req.user = decoded
    } catch (error) {
        if (error instanceof AppError) throw error
        throw new AppError('Unauthorized', 401)
    }
}

declare module 'fastify' {
    interface FastifyRequest {
        user?: {
            id: string
            role: string
        }
    }
}
