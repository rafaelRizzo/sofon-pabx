import type { FastifyInstance } from 'fastify'
import { flushCache } from './admin.controller'
import { verifyAdmin } from '../../middlewares/auth.middleware'

export const adminRoutes = async (app: FastifyInstance) => {
    app.post('/admin/cache/flush', { preHandler: verifyAdmin }, flushCache)
}
