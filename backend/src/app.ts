import Fastify, { LogController } from 'fastify'
import cookiePlugin from '@fastify/cookie'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import scalar from '@scalar/fastify-api-reference'
import { serializerCompiler, jsonSchemaTransform } from 'fastify-type-provider-zod'
import { ZodError, type ZodType } from 'zod'
import { randomUUID, createHash } from 'crypto'
import { logger } from './utils/logger'
import { formatDatesDeep, collectCompanyIds } from './utils/timezone'
import { getCompanyById } from './modules/companies/companies.service'
import { validateEnv } from './config/env'
import { redisClient } from './config/redis'
import { protectedRoute } from './middleware/scope.middleware'
import { usersRoutes } from './modules/users/users.routes'
import { authRoutes } from './modules/auth/auth.routes'
import { companiesRoutes } from './modules/companies/companies.routes'
import { didsRoutes } from './modules/dids/dids.routes'
import { extensionsRoutes } from './modules/extensions/extensions.routes'
import { queuesRoutes } from './modules/queues/queues.routes'
import { queueMembersRoutes } from './modules/queue-members/queue-members.routes'
import { trunksRoutes } from './modules/trunks/trunks.routes'
import { outboundRoutesRoutes } from './modules/outbound-routes/outbound-routes.routes'
import { timeGroupsRoutes } from './modules/time-groups/time-groups.routes'
import { timeConditionsRoutes } from './modules/time-conditions/time-conditions.routes'
import { holidayGroupsRoutes } from './modules/holiday-groups/holiday-groups.routes'
import { inboundRoutesRoutes } from './modules/inbound-routes/inbound-routes.routes'
import { cdrRoutes } from './modules/cdr/cdr.routes'
import { announcementsRoutes } from './modules/announcements/announcements.routes'
import { ivrRoutes } from './modules/ivr/ivr.routes'
import { requestTemplatesRoutes } from './modules/request-templates/request-templates.routes'
import { audiosRoutes } from './modules/audios/audios.routes'
import { variablesRoutes } from './modules/variables/variables.routes'
import { variableConditionsRoutes } from './modules/variable-conditions/variable-conditions.routes'
import { callcenterAgentsRoutes } from './modules/callcenter/agents/agents.routes'
import { routingRulesRoutes } from './modules/callcenter/routing-rules/routing-rules.routes'
import { callcenterRatingsRoutes } from './modules/callcenter/ratings/ratings.routes'
import { flowsRoutes } from './modules/flows/flows.routes'
import { queueCallsRoutes } from './modules/queue-calls/queue-calls.routes'
import { realtimeRoutes } from './modules/realtime/realtime.routes'

const env = validateEnv()

const app = Fastify({
    logger: false,
    logController: new LogController({ requestIdLogLabel: 'reqId' }),
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
})

// Compiler próprio: deixa o ZodError bruto passar (fastify-type-provider-zod embrulha em array e perde .issues)
app.setValidatorCompiler(({ schema }: { schema: ZodType }) => (data: unknown) => {
    const result = schema.safeParse(data)
    if (!result.success) return { error: result.error }
    return { value: result.data }
})
app.setSerializerCompiler(serializerCompiler)

// Formata cada Date da resposta com o offset da empresa dona do registro (via companyId), caindo em env.TZ quando não há empresa no contexto
app.addHook('preSerialization', async (request, reply, payload) => {
    if (request.url.startsWith('/docs')) return payload

    const companyIds = collectCompanyIds(payload)
    const tzByCompanyId = new Map<string, string>()

    await Promise.all([...companyIds].map(async (companyId) => {
        try {
            const company = await getCompanyById(companyId)
            tzByCompanyId.set(companyId, company.timezone)
        } catch {
            // companyId sumiu (delete concorrente) — cai no fallback env.TZ em vez de derrubar a resposta inteira
        }
    }))

    return formatDatesDeep(payload, env.TZ, tzByCompanyId)
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

// ETag pra GETs cacheáveis: revalida sempre (no-cache), mas devolve 304 sem body se o conteúdo
// não mudou. Exclui /realtime (snapshot + SSE) — muda a todo instante, hash seria desperdício
const ETAG_EXCLUDED_PREFIXES = ['/docs', '/realtime']

app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id)

    if (request.method !== 'GET') return payload
    if (ETAG_EXCLUDED_PREFIXES.some((prefix) => request.url.startsWith(prefix))) return payload
    if (reply.statusCode !== 200 || typeof payload !== 'string') return payload

    const etag = `"${createHash('sha1').update(payload).digest('hex')}"`
    reply.header('cache-control', 'no-cache')

    if (request.headers['if-none-match'] === etag) {
        reply.code(304)
        return ''
    }

    reply.header('etag', etag)
    return payload
})

app.addHook('onResponse', async (request, reply) => {
    logger.info({
        event: 'request.completed',
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTimeMs: reply.elapsedTime.toFixed(1),
    })
})

// Register swagger (must be before routes)
app.register(swagger, {
    openapi: {
        openapi: '3.0.0',
        info: {
            title: 'Sofon PABX API',
            description: 'API para gerenciamento de PABX IP',
            version: '1.0.0',
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
    },
    transform: jsonSchemaTransform,
})

app.register(scalar, {
    routePrefix: '/docs',
    configuration: {
        theme: 'purple',
        agent: {
            disabled: true,
        },
    },
})

// Register plugins
app.register(helmet, {
    contentSecurityPolicy: false,
})
app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Content-Disposition: front lê o filename real da gravação (GET /cdr/:id/recording) pra
    // nomear o download/play em vez de um nome genérico — sem isso o JS não enxerga esse header
    // em resposta cross-origin, mesmo vindo certo do backend
    exposedHeaders: ['Content-Disposition'],
})
app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
})
app.register(cookiePlugin)
app.register(multipart, {
    limits: {
        fileSize: 15 * 1024 * 1024,
        files: 1,
        fields: 2,
        fieldSize: 10 * 1024,
        parts: 3,
    },
    throwFileSizeLimit: true,
})

// Error handler
app.setErrorHandler((error: any, request, reply) => {
    if (error instanceof ZodError) {
        return reply.code(400).send({
            success: false,
            reqId: request.id,
            message: 'Validation error',
            errors: error.issues,
        })
    }

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
app.register(queuesRoutes)
app.register(queueMembersRoutes)
app.register(trunksRoutes)
app.register(outboundRoutesRoutes)
app.register(timeGroupsRoutes)
app.register(timeConditionsRoutes)
app.register(holidayGroupsRoutes)
app.register(inboundRoutesRoutes)
app.register(cdrRoutes)
app.register(announcementsRoutes)
app.register(ivrRoutes)
app.register(requestTemplatesRoutes)
app.register(audiosRoutes)
app.register(variablesRoutes)
app.register(variableConditionsRoutes)
app.register(callcenterAgentsRoutes)
app.register(routingRulesRoutes)
app.register(callcenterRatingsRoutes)
app.register(flowsRoutes)
app.register(queueCallsRoutes)
app.register(realtimeRoutes)

// Health check
app.get('/health', async (req, reply) => {
    try {
        await redisClient.ping()
        return reply.send({ status: 'ok', redis: 'ok' })
    } catch (error) {
        logger.error({
            event: 'health.redis.error',
            error: error instanceof Error ? error.message : String(error)
        })
        return reply.status(503).send({ status: 'error', redis: 'down' })
    }
})

// Config SIP/PJSIP da instância (versão do Asterisk define as portas — ver setups/install-asterisk.sh)
app.register(async (router) => {
    router.get('/system/sip-config', { onRequest: protectedRoute }, async (req, reply) => {
        return reply.send({
            success: true,
            asteriskVersion: env.ASTERISK_VERSION ?? null,
            legacySipEnabled: env.SIP_LEGACY_ENABLED,
            sipPort: env.SIP_LEGACY_ENABLED ? env.SIP_PORT ?? null : null,
            pjsipPort: env.PJSIP_PORT,
        })
    })
})

export { app }
