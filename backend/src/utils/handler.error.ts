import { type FastifyRequest, type FastifyReply } from 'fastify'
import { z } from 'zod'

export class AppError extends Error {
    constructor(
        public override message: string,
        public statusCode: number = 500
    ) {
        super(message)
        this.name = this.constructor.name
        Error.captureStackTrace(this, this.constructor)
    }
}

export const handleError = (
    request: FastifyRequest,
    reply: FastifyReply,
    error: unknown,
    message: string = 'An unexpected error occurred'
) => {
    if (request.log) {
        request.log.error(error)
    } else {
        console.error(error)
    }

    if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
            success: false,
            message: error.message
        })
    }

    if (error instanceof z.ZodError) {
        return reply.status(400).send({
            success: false,
            message: 'Validation failed',
            errors: error.issues
        })
    }

    return reply.status(500).send({
        success: false,
        message
    })
}