import type { FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { AppError } from './app.error'
import { logger } from '../logger'

export const handleError = (reply: FastifyReply, error: unknown, req?: FastifyRequest) => {
  const reqId = req?.id

  if (error instanceof ZodError) {
    return reply.code(400).send({
      success: false,
      reqId,
      message: 'Validation error',
      errors: error.issues,
    })
  }

  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      success: false,
      reqId,
      message: error.message,
    })
  }

  if (error instanceof Error) {
    logger.error({
      event: 'error.unhandled',
      reqId,
      message: error.message,
      stack: error.stack,
    })
  }

  return reply.code(500).send({
    success: false,
    reqId,
    message: 'Internal server error',
  })
}
