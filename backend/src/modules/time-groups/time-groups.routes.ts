import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as TimeGroupsController from './time-groups.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { createTimeGroupSchema, updateTimeGroupSchema, idParamSchema, companyQuerySchema, TimeGroupSchema } from './schemas/time-group.schema'
import { errors, ok, deleted } from '../../schemas/responses'

export const timeGroupsRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/time-groups', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Time Groups'],
            summary: 'Listar grupos de horário por empresa',
            security: [{ bearerAuth: [] }],
            querystring: companyQuerySchema,
            response: {
                200: ok({ message: z.string(), timeGroups: z.array(TimeGroupSchema) }),
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, TimeGroupsController.getTimeGroupsByCompanyId as any)

    router.get('/time-groups/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Time Groups'],
            summary: 'Buscar grupo de horário',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: ok({ message: z.string(), timeGroup: TimeGroupSchema }),
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, TimeGroupsController.getTimeGroupById as any)

    router.post('/time-groups', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Time Groups'],
            summary: 'Criar grupo de horário',
            security: [{ bearerAuth: [] }],
            body: createTimeGroupSchema,
            response: {
                201: ok({ message: z.string(), timeGroupId: z.string() }),
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, TimeGroupsController.createTimeGroup as any)

    router.put('/time-groups/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Time Groups'],
            summary: 'Atualizar grupo de horário',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateTimeGroupSchema,
            response: {
                200: ok({ message: z.string() }),
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, TimeGroupsController.updateTimeGroup as any)

    router.delete('/time-groups/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Time Groups'],
            summary: 'Remover grupo de horário',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, TimeGroupsController.deleteTimeGroup as any)
}
