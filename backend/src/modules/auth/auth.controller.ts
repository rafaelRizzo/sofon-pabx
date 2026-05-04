import type { FastifyRequest, FastifyReply } from 'fastify'
import * as AuthService from './auth.service'
import { handleError } from '../../utils/handlers/handler.errors'
import { authUserSchema } from './schemas/auth.schema'
import { jtiManager } from '../../utils/jwt/jti.cache'
import jwt from 'jsonwebtoken'

export const authUser = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = authUserSchema.parse(req.body)

        const { token } = await AuthService.authUser(data)

        return reply.status(200).send({
            success: true,
            message: 'Login realizado com sucesso',
            token
        })

    } catch (error) {
        return handleError(reply, error)
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

        return reply.status(200).send({
            success: true,
            message: 'Logout realizado com sucesso'
        })
    } catch (error) {
        return handleError(reply, error)
    }
}