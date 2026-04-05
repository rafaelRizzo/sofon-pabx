import type { FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { AppError } from './app.error'

export function handleError(reply: FastifyReply, error: unknown) {
    if (error instanceof ZodError) {
        return reply.status(400).send({
            success: false,
            message: 'Validation error',
            errors: error.issues
        })
    }

    if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
            success: false,
            message: error.message
        })
    }

    console.error(error)
    return reply.status(500).send({
        success: false,
        message: 'Internal server error'
    })
}