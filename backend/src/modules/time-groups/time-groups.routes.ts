import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as TimeGroupsController from './time-groups.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import {
    createTimeGroupSchema, updateTimeGroupSchema, idParamSchema, companyQuerySchema,
    ListTimeGroupsResponse, GetTimeGroupResponse, CreateTimeGroupResponse, UpdateTimeGroupResponse,
} from './schemas/time-group.schema'
import { errors, deleted } from '../../schemas/responses'

const optionalCompanyQuery = z.object({ companyId: z.cuid2().optional() })

export const timeGroupsRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/time-groups', {
        onRequest: [...protectedRoute, requirePermission('time-groups', 'view')],
        schema: {
            tags: ['Time Groups'],
            summary: 'Listar grupos de horário',
            description: 'Filtra por empresa via ?companyId.',
            security: [{ bearerAuth: [] }],
            querystring: optionalCompanyQuery,
            response: {
                200: ListTimeGroupsResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, TimeGroupsController.getTimeGroupsByCompanyId as any)

    router.get('/time-groups/:id', {
        onRequest: [...protectedRoute, requirePermission('time-groups', 'view')],
        schema: {
            tags: ['Time Groups'],
            summary: 'Buscar grupo de horário',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: GetTimeGroupResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, TimeGroupsController.getTimeGroupById as any)

    router.post('/time-groups', {
        onRequest: [...protectedRoute, requirePermission('time-groups', 'manage')],
        schema: {
            tags: ['Time Groups'],
            summary: 'Criar grupo de horário',
            security: [{ bearerAuth: [] }],
            body: createTimeGroupSchema,
            response: {
                201: CreateTimeGroupResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, TimeGroupsController.createTimeGroup as any)

    router.put('/time-groups/:id', {
        onRequest: [...protectedRoute, requirePermission('time-groups', 'manage')],
        schema: {
            tags: ['Time Groups'],
            summary: 'Atualizar grupo de horário',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateTimeGroupSchema,
            response: {
                200: UpdateTimeGroupResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, TimeGroupsController.updateTimeGroup as any)

    router.delete('/time-groups/:id', {
        onRequest: [...protectedRoute, requirePermission('time-groups', 'manage')],
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
