import type { FastifyInstance } from 'fastify'
import { authMiddleware, adminMiddleware } from '../../middlewares/middleware.auth'
import {
    createTimeRuleSchema,
    getTimeRuleSchema,
    updateTimeRuleSchema,
    deleteTimeRuleSchema
} from './schema/timeRule.schema'
import { TimeRulesController } from '../../controllers/timeRules/timeRules.controller'

export const timeRulesRoutes = async (fastify: FastifyInstance) => {
    const authAdmin = { preHandler: authMiddleware, adminMiddleware }

    fastify.post(
        '/time-rules',
        { ...authAdmin, schema: createTimeRuleSchema },
        (request, reply) => new TimeRulesController(request, reply).create()
    )

    fastify.get(
        '/time-rules',
        authAdmin,
        (request, reply) => new TimeRulesController(request, reply).list()
    )

    fastify.get(
        '/time-rules/:id',
        { ...authAdmin, schema: getTimeRuleSchema },
        (request, reply) => new TimeRulesController(request, reply).getById()
    )

    fastify.put(
        '/time-rules/:id',
        { ...authAdmin, schema: updateTimeRuleSchema },
        (request, reply) => new TimeRulesController(request, reply).update()
    )

    fastify.delete(
        '/time-rules/:id',
        { ...authAdmin, schema: deleteTimeRuleSchema },
        (request, reply) => new TimeRulesController(request, reply).delete()
    )
}
