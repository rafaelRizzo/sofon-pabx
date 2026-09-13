import type { FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'
import * as AuthService from './auth.service'
import { loginSchema, registerSchema } from './schemas/auth.schema'
import { handleError } from '../../utils/errors/handler.error'
import { jtiManager } from '../../lib/jti'
import { prisma } from '../../lib/prisma'

export const login = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = loginSchema.parse(req.body)
        const tokens = await AuthService.login(data)

        reply.setCookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        })

        return reply.status(200).send({
            success: true,
            message: 'Login successful',
            token: tokens.token,
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const refresh = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const refreshToken = req.cookies.refreshToken

        if (!refreshToken) {
            return reply.status(401).send({
                success: false,
                message: 'Refresh token not found',
            })
        }

        const tokens = await AuthService.refreshAccessToken(refreshToken)

        reply.setCookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        })

        return reply.status(200).send({
            success: true,
            message: 'Token refreshed successfully',
            token: tokens.token,
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const logout = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const auth = req.headers.authorization
        const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null

        if (token) {
            const decoded = jwt.decode(token) as { jti?: string }
            if (decoded?.jti) {
                await jtiManager.revoke(decoded.jti)
            }
        }

        // revoga também o JTI do refresh (cookie) - senão o refresh sobreviveria ao logout por 7 dias
        const refreshToken = req.cookies.refreshToken
        if (refreshToken) {
            const decodedRefresh = jwt.decode(refreshToken) as { jti?: string }
            if (decodedRefresh?.jti) {
                await jtiManager.revoke(decodedRefresh.jti)
            }
        }

        reply.clearCookie('refreshToken', { path: '/' })

        return reply.status(200).send({
            success: true,
            message: 'Logout successful',
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const me = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            select: { id: true, name: true, username: true, role: true, permissions: true, extensionId: true, avatarUpdatedAt: true },
        })

        if (!user) {
            return reply.status(404).send({ success: false, message: 'User not found' })
        }

        return reply.send({ success: true, message: 'User fetched successfully', user })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const register = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = registerSchema.parse(req.body)
        const tokens = await AuthService.register(data)

        reply.setCookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        })

        return reply.status(201).send({
            success: true,
            message: 'User registered successfully',
            token: tokens.token,
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
