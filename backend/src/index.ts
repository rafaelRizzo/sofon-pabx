import { logger } from './utils/logger'
import Fastify from 'fastify'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import fastifyJwt from '@fastify/jwt'

import { userRoutes } from './modules/users/user.route'
import { authRoutes } from './modules/auth/auth.route'
import { checkEnvsInit } from './utils/handlers/check.envs'
import { companyRoutes } from './modules/companies/companies.route'
import { instanceRoutes } from './modules/instances/instances.route'
import { officeTimeRoutes } from './modules/office_time/office_time.route'

// check envs
checkEnvsInit()

const app = Fastify({
    trustProxy: true,
    loggerInstance: logger
})

const ALLOWED_IPS = (process.env.ALLOWED_IPS ?? '127.0.0.1').split(',')

app.addHook('onRequest', (req, reply, done) => {
    const clientIp = req.ip

    if (!ALLOWED_IPS.includes(clientIp)) {
        app.log.warn(`Blocked request from IP: ${clientIp}`)
        reply.status(403).send({ message: 'Forbidden' })
        return
    }

    done()
})

// segurança
await app.register(helmet)

await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? '*'
})

await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
})

app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'supersecret'
})

// Health check basic
app.get('/health', () => ({ status: 'ok' }))

// Graceful shutdown
const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`)
    await app.close()
    process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

await app.register(userRoutes)
await app.register(authRoutes)
await app.register(companyRoutes)
await app.register(instanceRoutes)
await app.register(officeTimeRoutes)

try {
    await app.listen({
        port: Number(process.env.PORT) || 3333,
        host: '0.0.0.0'
    })
} catch (err) {
    app.log.error(err)
    process.exit(1)
}