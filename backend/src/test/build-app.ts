import Fastify from 'fastify'
import cookiePlugin from '@fastify/cookie'
import type { FastifyInstance } from 'fastify'
import { authRoutes } from '../modules/auth/auth.routes'
import { usersRoutes } from '../modules/users/users.routes'
import { companiesRoutes } from '../modules/companies/companies.routes'
import { didsRoutes } from '../modules/dids/dids.routes'
import { extensionsRoutes } from '../modules/extensions/extensions.routes'
import { queuesRoutes } from '../modules/queues/queues.routes'
import { queueMembersRoutes } from '../modules/queue-members/queue-members.routes'
import { connectRedis } from '../config/redis'

export const buildApp = async (): Promise<FastifyInstance> => {
    await connectRedis()

    const app = Fastify({ logger: false })
    await app.register(cookiePlugin)
    await app.register(authRoutes)
    await app.register(usersRoutes)
    await app.register(companiesRoutes)
    await app.register(didsRoutes)
    await app.register(extensionsRoutes)
    await app.register(queuesRoutes)
    await app.register(queueMembersRoutes)
    await app.ready()
    return app
}
