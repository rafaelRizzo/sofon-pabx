import Fastify from 'fastify'
import cookiePlugin from '@fastify/cookie'
import type { FastifyInstance } from 'fastify'
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod'
import { authRoutes } from '../modules/auth/auth.routes'
import { usersRoutes } from '../modules/users/users.routes'
import { companiesRoutes } from '../modules/companies/companies.routes'
import { didsRoutes } from '../modules/dids/dids.routes'
import { extensionsRoutes } from '../modules/extensions/extensions.routes'
import { queuesRoutes } from '../modules/queues/queues.routes'
import { queueMembersRoutes } from '../modules/queue-members/queue-members.routes'
import { trunksRoutes } from '../modules/trunks/trunks.routes'
import { outboundRoutesRoutes } from '../modules/outbound-routes/outbound-routes.routes'
import { timeGroupsRoutes } from '../modules/time-groups/time-groups.routes'
import { timeConditionsRoutes } from '../modules/time-conditions/time-conditions.routes'
import { connectRedis } from '../config/redis'

export const buildApp = async (): Promise<FastifyInstance> => {
    await connectRedis()

    const app = Fastify({ logger: false })
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    app.setErrorHandler((error: any, _req, reply) => {
        const statusCode = error.statusCode || 500
        reply.code(statusCode).send({ success: false, message: error.message || 'Internal server error' })
    })
    await app.register(cookiePlugin)
    await app.register(authRoutes)
    await app.register(usersRoutes)
    await app.register(companiesRoutes)
    await app.register(didsRoutes)
    await app.register(extensionsRoutes)
    await app.register(queuesRoutes)
    await app.register(queueMembersRoutes)
    await app.register(trunksRoutes)
    await app.register(outboundRoutesRoutes)
    await app.register(timeGroupsRoutes)
    await app.register(timeConditionsRoutes)
    await app.ready()
    return app
}
