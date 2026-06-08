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

        if (decoded.jti) {
            const jtiExists = await jtiManager.exists(decoded.jti)
            if (!jtiExists) {
                throw new AppError('Token revoked', 401)
            }
        }

        req.user = decoded
    } catch (error) {
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
