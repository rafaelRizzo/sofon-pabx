import type { FastifyRequest, FastifyReply } from 'fastify'
import * as AuthService from './auth.service'
import { handleError } from '../../utils/handlers/handler.errors'
import { authUserSchema } from '../../modules/auth/schema/auth.schema'

export const authUser = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = authUserSchema.parse(req.body)
        const { token } = await AuthService.authUser(data)

        return reply.status(200).send({
            success: true,
            message: 'User authenticated successfully',
            token
        })
    } catch (error) {
        return handleError(reply, error)
    }
}