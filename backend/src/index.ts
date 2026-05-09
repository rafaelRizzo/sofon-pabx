import { logger } from './utils/logger'
import { requestContext } from './utils/context/request.context'
import { cacheManager } from './utils/cache/cache.manager'
import { redisClient } from './utils/cache/redis.client'
import { getHealthStatus } from './utils/health/health.check'
import { startCleanupJob } from './jobs/cleanup-tokens'
import Fastify from 'fastify'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import fastifyJwt from '@fastify/jwt'
import cookie from '@fastify/cookie'

import { authRoutes } from './modules/auth/auth.routes'
import { userRoutes } from './modules/users/user.routes'
import { planRoutes } from './modules/plans/plans.routes'
import { companyRoutes } from './modules/companies/companies.routes'
import { extensionRoutes } from './modules/extensions/extensions.routes'
import { trunkRoutes } from './modules/trunks/trunks.routes'
import { queueRoutes } from './modules/queues/queues.routes'

const app = Fastify({
    trustProxy: true,
    loggerInstance: logger,
    genReqId: () => crypto.randomUUID()
})

// 1. IPs Permitidos
const ALLOWED_IPS = (process.env.ALLOWED_IPS ?? '127.0.0.1,::1')
    .split(',')
    .map(ip => ip.trim())
    .filter(Boolean)

app.addHook('onRequest', (req, reply, done) => {
    req.startTime = Date.now()
    requestContext.run({ reqId: req.id as string }, () => {
        const clientIp = req.ip
        if (!ALLOWED_IPS.includes(clientIp)) {
            app.log.warn({
                reqId: req.id,
                event: 'IP_BLOCKED',
                method: req.method,
                path: req.url,
                ip: clientIp
            })
            reply.status(403).send({ success: false, message: 'Forbidden: IP not allowed' })
            return
        }
        done()
    })
})

app.addHook('onResponse', (req, reply, done) => {
    const duration = Date.now() - (req.startTime || Date.now())
    const level = reply.statusCode >= 400 ? 'warn' : 'info'

    logger[level]({
        reqId: req.id,
        event: 'HTTP_RESPONSE',
        method: req.method,
        path: req.url.split('?')[0],
        statusCode: reply.statusCode,
        duration: `${duration}ms`,
        ip: req.ip
    })
    done()
})

// 2. CORS
const ALLOWED_ORIGINS = (process.env.ALLOWED_CORS ?? 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)

await app.register(cors, {
    origin: (origin, cb) => {
        if (!origin) { cb(null, true); return }
        if (ALLOWED_ORIGINS.includes(origin)) { cb(null, true); return }
        if (process.env.NODE_ENV !== 'production') {
            if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
                cb(null, true)
                return
            }
        }
        cb(new Error('Not allowed by CORS'), false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    maxAge: 86400,
})

// 3. Cookie (antes do JWT)
await app.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'your-secret-key-change-this',
    parseOptions: {}
})

// 4. JWT
await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'supersecret',
    sign: { expiresIn: '7d' }
})

// 5. Helmet
await app.register(helmet, {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
        },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
})

// 6. Rate Limiting
await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1']
})

app.setNotFoundHandler((req, reply) => {
    reply.status(404).send({
        success: false,
        reqId: req.id,
        message: 'Route not found'
    })
})

// ==================== ROTAS ====================
await app.register(authRoutes)
await app.register(userRoutes)
await app.register(planRoutes)
await app.register(companyRoutes)
await app.register(extensionRoutes)
await app.register(trunkRoutes)
await app.register(queueRoutes)

app.get('/health', async (req, reply) => {
    const health = await getHealthStatus()
    const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 503 : 503
    return reply.status(statusCode).send(health)
})

// ==================== GRACEFUL SHUTDOWN ====================
const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`)
    await cacheManager.disconnect()
    await app.close()
    process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

try {
    redisClient.on('connect', () => logger.info({ event: 'redis.connected' }))
    redisClient.on('ready', () => logger.info({ event: 'redis.ready' }))
    redisClient.on('error', (err) => logger.error({ event: 'redis.error', error: err.message }))

    await cacheManager.connect()
    startCleanupJob()
    await app.listen({
        port: Number(process.env.PORT) || 3333,
        host: '0.0.0.0'
    })
} catch (err) {
    app.log.error(err)
    process.exit(1)
}
