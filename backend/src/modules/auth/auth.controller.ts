import type { FastifyRequest, FastifyReply } from 'fastify'
import * as AuthService from './auth.service'
import { handleError } from '../../utils/handlers/handler.errors'
import { authUserSchema } from './schemas/auth.schema'
import { jtiManager } from '../../utils/jwt/jti.cache'
import { revokeRefreshTokenByJti } from '../../utils/jwt/handler.jwt'
import jwt from 'jsonwebtoken'

export const authUser = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = authUserSchema.parse(req.body)
        const { token, refreshToken } = await AuthService.authUser(data)

        reply.setCookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60,
            path: '/'
        })

        return reply.status(200).send({
            success: true,
            message: 'Login realizado com sucesso',
            token
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const refresh = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const refreshToken = req.cookies.refreshToken

        if (!refreshToken) {
            return reply.status(401).send({
                success: false,
                message: 'Refresh token não encontrado'
            })
        }

        const tokens = await AuthService.refreshAuth(refreshToken)

        reply.setCookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60,
            path: '/'
        })

        return reply.status(200).send({
            success: true,
            message: 'Token renovado com sucesso',
            token: tokens.token
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const logout = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const auth = req.headers.authorization
        const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
        const refreshToken = req.cookies.refreshToken

        if (token) {
            const decoded = jwt.decode(token) as { jti?: string }
            if (decoded?.jti) {
                await jtiManager.revoke(decoded.jti)
            }
        }

        if (refreshToken) {
            const decoded = jwt.decode(refreshToken) as { jti?: string }
            if (decoded?.jti) {
                await jtiManager.revokeRefresh(decoded.jti)
                await revokeRefreshTokenByJti(decoded.jti)
            }
        }

        reply.clearCookie('refreshToken', { path: '/auth' })

        return reply.status(200).send({
            success: true,
            message: 'Logout realizado com sucesso'
        })
    } catch (error) {
        return handleError(reply, error)
    }
}