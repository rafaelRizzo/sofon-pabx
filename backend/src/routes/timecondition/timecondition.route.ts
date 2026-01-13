import type { FastifyInstance } from 'fastify'
import { authMiddleware, adminMiddleware } from '../../middlewares/middleware.auth'
import {
    createTimeConditionSchema,
    getTimeConditionSchema,
    updateTimeConditionSchema,
    deleteTimeConditionSchema
} from './schema/timecondition.schema'
import { TimeConditionController } from '../../controllers/timecondition/timecondition.controller'

export const timeConditionRoutes = async (fastify: FastifyInstance) => {
    const authAdmin = { preHandler: authMiddleware, adminMiddleware }

    fastify.post(
        '/time-conditions',
        { ...authAdmin, schema: createTimeConditionSchema },
        (request, reply) => new TimeConditionController(request, reply).create()
    )

    fastify.get(
        '/time-conditions',
        authAdmin,
        (request, reply) => new TimeConditionController(request, reply).list()
    )

    fastify.get(
        '/time-conditions/:id',
        { ...authAdmin, schema: getTimeConditionSchema },
        (request, reply) => new TimeConditionController(request, reply).getById()
    )

    fastify.put(
        '/time-conditions/:id',
        { ...authAdmin, schema: updateTimeConditionSchema },
        (request, reply) => new TimeConditionController(request, reply).update()
    )

    fastify.delete(
        '/time-conditions/:id',
        { ...authAdmin, schema: deleteTimeConditionSchema },
        (request, reply) => new TimeConditionController(request, reply).delete()
    )
}
