import type { FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { AppError } from './app.error'

export const handleError = (reply: FastifyReply, error: unknown, req?: FastifyRequest) => {
    const reqId = req?.id

    if (error instanceof ZodError) {
        return reply.status(400).send({
            success: false,
            reqId,
            message: 'Validation error',
            errors: error.issues
        })
    }

    if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
            success: false,
            reqId: error.reqId ?? reqId,
            message: error.message
        })
    }

    req?.log.error({ reqId, error }, 'Unhandled error')
    return reply.status(500).send({
        success: false,
        reqId,
        message: 'Internal server error'
    })
}