import type { FastifyRequest, FastifyReply } from 'fastify'
import { authMiddleware } from './auth.middleware'
import { AppError } from '../utils/errors/app.error'
import { getUserCompanyIds, isAdmin } from '../utils/auth/access'

export type RequestScope = {
    isAdmin: boolean
    companyIds: string[] | null
    canAccess(companyId: string): boolean
    assertAccess(companyId: string): void
}

export const scopeMiddleware = async (req: FastifyRequest, _reply: FastifyReply) => {
    if (!req.user) throw new AppError('Unauthorized', 401)

    const { id, role } = req.user
    const admin = isAdmin(role)

    const companyIds = admin ? null : await getUserCompanyIds(id)

    req.scope = {
        isAdmin: admin,
        companyIds,
        canAccess: (cid) => admin || companyIds!.includes(cid),
        assertAccess: (cid) => {
            if (!admin && !companyIds!.includes(cid)) throw new AppError('Forbidden', 403)
        },
    }
}

export const requireAdmin = async (req: FastifyRequest, _reply: FastifyReply) => {
    if (!req.scope?.isAdmin) throw new AppError('Forbidden', 403)
}

export const protectedRoute = [authMiddleware, scopeMiddleware]

declare module 'fastify' {
    interface FastifyRequest {
        scope: RequestScope
    }
}
