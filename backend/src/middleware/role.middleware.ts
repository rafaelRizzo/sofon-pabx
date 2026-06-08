import type { FastifyRequest, FastifyReply } from 'fastify'
import { AppError } from '../utils/errors/app.error'

export const requireRole = (...roles: string[]) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
        if (!roles.includes(req.user!.role)) {
            throw new AppError('Forbidden', 403)
        }
    }
}
