import Fastify from 'fastify'
import cookiePlugin from '@fastify/cookie'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { randomUUID } from 'crypto'
import { logger } from './utils/logger'
import { validateEnv } from './config/env'
import { usersRoutes } from './modules/users/users.routes'
import { authRoutes } from './modules/auth/auth.routes'
import { companiesRoutes } from './modules/companies/companies.routes'
import { didsRoutes } from './modules/dids/dids.routes'
import { extensionsRoutes } from './modules/extensions/extensions.routes'

const env = validateEnv()

const app = Fastify({
    logger: false,
    requestIdLogLabel: 'reqId',
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
})

// Adiciona logging para requests
app.addHook('onRequest', async (request, reply) => {
    request.id = request.id || randomUUID()
    logger.info({
        event: 'request.incoming',
        method: request.method,
        url: request.url,
        ip: request.ip,
    })
})

app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id)
})

app.addHook('onResponse', async (request, reply) => {
    logger.info({
        event: 'request.completed',
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
    })
})

// Register plugins
app.register(helmet, {
    contentSecurityPolicy: false,
})
app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
})
app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
})
app.register(cookiePlugin)

// Error handler
app.setErrorHandler((error: any, request, reply) => {
    const statusCode = error.statusCode || 500
    const message = error.message || 'Internal server error'

    reply.code(statusCode).send({
        success: false,
        reqId: request.id,
        message,
    })
})

// Register routes
app.register(authRoutes)
app.register(usersRoutes)
app.register(companiesRoutes)
app.register(didsRoutes)
app.register(extensionsRoutes)

// Health check
app.get('/health', async (req, reply) => {
    return reply.send({ status: 'ok' })
})

export { app }

