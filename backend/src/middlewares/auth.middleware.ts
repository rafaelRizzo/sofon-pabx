import type { FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'
import { createAuthLogger } from '../utils/logger'
import { jtiManager } from '../utils/jwt/jti.cache'

export interface JWTPayload {
    id: string
    email: string
    role: 'admin' | 'user'
    jti?: string
    iat?: number
    exp?: number
}

declare module 'fastify' {
    interface FastifyRequest {
        jti?: string
    }
}

declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: JWTPayload
        user: JWTPayload
    }
}

const getToken = (req: FastifyRequest): string | null => {
    const auth = req.headers.authorization
    return auth?.startsWith('Bearer ') ? auth.slice(7) : null
}

const extractJti = (token: string): string | null => {
    try {
        const decoded = jwt.decode(token) as { jti?: string }
        return decoded?.jti ?? null
    } catch {
        return null
    }
}

export const verifyToken = async (req: FastifyRequest, reply: FastifyReply) => {
    const log = createAuthLogger(req)
    const token = getToken(req)
    const start = Date.now()

    if (!token) {
        log.warn('auth.token_missing')
        return reply.status(401).send({
            success: false,
            message: 'Token não fornecido'
        })
    }

    const jti = extractJti(token)
    req.jti = jti ?? undefined

    try {
        const jtiValid = await jtiManager.exists(jti!)
        if (!jti || !jtiValid) {
            log.warn('auth.token_revoked', { jti, duration: Date.now() - start })
            return reply.status(401).send({
                success: false,
                message: 'Token revogado'
            })
        }

        await req.jwtVerify()
        log.info('auth.verified', {
            userId: req.user.id,
            role: req.user.role,
            jti,
            duration: Date.now() - start
        })
    } catch (error: any) {
        log.error('auth.token_invalid', error, {
            jti,
            duration: Date.now() - start
        })
        return reply.status(401).send({
            success: false,
            message: 'Token inválido ou expirado'
        })
    }
}

export const verifyAdmin = async (req: FastifyRequest, reply: FastifyReply) => {
    const log = createAuthLogger(req)
    const token = getToken(req)
    const start = Date.now()

    if (!token) {
        log.warn('auth.admin_token_missing')
        return reply.status(401).send({
            success: false,
            message: 'Token não fornecido'
        })
    }

    const jti = extractJti(token)
    req.jti = jti ?? undefined

    try {
        const jtiValid = await jtiManager.exists(jti!)
        if (!jti || !jtiValid) {
            log.warn('auth.token_revoked', { jti, duration: Date.now() - start })
            return reply.status(401).send({
                success: false,
                message: 'Token revogado'
            })
        }

        await req.jwtVerify()

        if (req.user.role !== 'admin') {
            log.warn('auth.admin_forbidden', {
                userId: req.user.id,
                role: req.user.role,
                jti,
                duration: Date.now() - start
            })
            return reply.status(403).send({
                success: false,
                message: 'Acesso negado'
            })
        }

        log.info('auth.admin_verified', {
            userId: req.user.id,
            jti,
            duration: Date.now() - start
        })
    } catch (error: any) {
        log.error('auth.admin_invalid', error, {
            jti,
            duration: Date.now() - start
        })
        return reply.status(401).send({
            success: false,
            message: 'Token inválido ou expirado'
        })
    }
}