import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import path from 'path'
import fs from 'fs'
import { userRoutes } from './routes/user/user.route'
import { createStream } from 'rotating-file-stream'
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod'
import { authRoutes } from './routes/auth/auth.route'
import { companyRoutes } from './routes/company/company.route'
import { audioRoutes } from './routes/audio/audio.route'
import { inboundRouteRoutes } from './routes/inboundRoute/inboundRoute.route'
import { announcementRoutes } from './routes/announcement/announcement.route'
import { timeConditionRoutes } from './routes/timecondition/timecondition.route'
import { timeRulesRoutes } from './routes/timeRule/timeRule.route'
import { ivrRoutes } from './routes/ivr/ivr.route'
import { ivrOptionRoutes } from './routes/ivrOption/ivrOption.route'
import { extensionRoutes } from './routes/extension/extension.route'

const isDevelopment = process.env.NODE_ENV === 'development'

declare module 'fastify' {
    interface FastifyRequest {
        clientIp: string
    }
}

if (!isDevelopment) {
    const logsDir = path.join(process.cwd(), 'logs')
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true })
    }
}

const appLogStream = !isDevelopment ? createStream('app.log', {
    interval: '1d',
    path: path.join(process.cwd(), 'logs'),
    maxFiles: 30,
    compress: 'gzip'
}) : null

const errorLogStream = !isDevelopment ? createStream('error.log', {
    interval: '1d',
    path: path.join(process.cwd(), 'logs'),
    maxFiles: 30,
    compress: 'gzip'
}) : null

export async function build() {
    const fastify = Fastify({
        logger: isDevelopment
            ? {
                level: process.env.LOG_LEVEL || 'info',
                transport: {
                    target: 'pino-pretty',
                    options: {
                        colorize: true,
                        translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
                        ignore: 'pid,hostname',
                        singleLine: false
                    }
                }
            }
            : {
                level: process.env.LOG_LEVEL || 'info',
                stream: {
                    write: (msg: string) => {
                        try {
                            const log = JSON.parse(msg)
                            if (appLogStream) appLogStream.write(msg)
                            if (log.level >= 50 && errorLogStream) {
                                errorLogStream.write(msg)
                            }
                        } catch (e) {
                            if (appLogStream) appLogStream.write(msg)
                        }
                    }
                }
            },
        trustProxy: true,
        requestIdHeader: 'x-request-id',
        requestIdLogLabel: 'reqId'
    }).withTypeProvider<ZodTypeProvider>()

    // Adicionar validadores Zod
    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)

    const ALLOWED_IPS: string[] = process.env.ALLOWED_IPS?.split(',').map(ip => ip.trim()) || []
    const ENABLE_IP_WHITELIST: boolean = process.env.ENABLE_IP_WHITELIST === 'true'

    await fastify.register(helmet, {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", 'data:', 'https:']
            }
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    })

    // Registra o plugin de multipart
    await fastify.register(multipart, {
        limits: {
            fileSize: 50 * 1024 * 1024, // 50MB
            files: 1 // máximo 1 arquivo por request
        }
    })

    await fastify.register(cors, {
        origin: process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || ['http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['X-Request-Id'],
        maxAge: 600
    })

    await fastify.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
        cache: 10000,
        allowList: ALLOWED_IPS,
        addHeaders: {
            'x-ratelimit-limit': true,
            'x-ratelimit-remaining': true,
            'x-ratelimit-reset': true
        },
        keyGenerator: (request: FastifyRequest): string => {
            return request.ip
        }
    })

    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const clientIp: string = request.ip
        request.clientIp = clientIp

        request.log.info({
            clientIp,
            url: request.url,
            method: request.method,
            userAgent: request.headers['user-agent']
        }, 'Request received')

        if (ENABLE_IP_WHITELIST && ALLOWED_IPS.length > 0) {
            if (!ALLOWED_IPS.includes(clientIp)) {
                request.log.warn({ clientIp, url: request.url, method: request.method }, 'Unauthorized IP attempt')
                return reply.code(403).send({
                    error: 'Forbidden',
                    message: 'Your IP address is not authorized to access this API'
                })
            }
        }
    })

    fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        reply.header('X-Content-Type-Options', 'nosniff')
        reply.header('X-Frame-Options', 'DENY')
        reply.header('X-XSS-Protection', '1; mode=block')
        reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
        reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()')
    })

    fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        request.log.info({
            clientIp: request.clientIp,
            url: request.url,
            method: request.method,
            statusCode: reply.statusCode
        }, 'Request completed')
    })

    fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            requestIp: request.clientIp,
            uptime: process.uptime()
        }
    })

    await fastify.register(userRoutes)
    await fastify.register(authRoutes)
    await fastify.register(companyRoutes)
    await fastify.register(audioRoutes)
    await fastify.register(inboundRouteRoutes)
    await fastify.register(announcementRoutes)
    await fastify.register(timeConditionRoutes)
    await fastify.register(timeRulesRoutes)
    await fastify.register(ivrRoutes)
    await fastify.register(ivrOptionRoutes)
    await fastify.register(extensionRoutes)

    fastify.setErrorHandler((error: Error, request: FastifyRequest, reply: FastifyReply) => {
        request.log.error({
            err: error,
            clientIp: request.clientIp,
            url: request.url,
            method: request.method,
            stack: error.stack
        }, 'Error occurred')

        if (process.env.NODE_ENV === 'production') {
            reply.status((error as any).statusCode || 500).send({
                error: 'Internal Server Error',
                message: 'An error occurred processing your request'
            })
        } else {
            reply.status((error as any).statusCode || 500).send({
                error: error.name,
                message: error.message,
                stack: error.stack
            })
        }
    })

    return fastify
}