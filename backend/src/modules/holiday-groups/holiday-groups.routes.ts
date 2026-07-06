import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as HolidayGroupsController from './holiday-groups.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import {
    createHolidayGroupSchema, updateHolidayGroupSchema, idParamSchema, companyQuerySchema,
    ListHolidayGroupsResponse, GetHolidayGroupResponse, CreateHolidayGroupResponse, UpdateHolidayGroupResponse,
} from './schemas/holiday-group.schema'
import { errors, deleted } from '../../schemas/responses'

export const holidayGroupsRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/holiday-groups', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Holiday Groups'],
            summary: 'Listar grupos de feriados por empresa',
            security: [{ bearerAuth: [] }],
            querystring: companyQuerySchema,
            response: {
                200: ListHolidayGroupsResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, HolidayGroupsController.getHolidayGroupsByCompanyId as any)

    router.get('/holiday-groups/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Holiday Groups'],
            summary: 'Buscar grupo de feriados',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: GetHolidayGroupResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, HolidayGroupsController.getHolidayGroupById as any)

    router.post('/holiday-groups', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Holiday Groups'],
            summary: 'Criar grupo de feriados — datas manuais ou auto-atualizadas por url',
            security: [{ bearerAuth: [] }],
            body: createHolidayGroupSchema,
            response: {
                201: CreateHolidayGroupResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, HolidayGroupsController.createHolidayGroup as any)

    router.put('/holiday-groups/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Holiday Groups'],
            summary: 'Atualizar grupo de feriados',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateHolidayGroupSchema,
            response: {
                200: UpdateHolidayGroupResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, HolidayGroupsController.updateHolidayGroup as any)

    router.delete('/holiday-groups/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Holiday Groups'],
            summary: 'Remover grupo de feriados',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, HolidayGroupsController.deleteHolidayGroup as any)
}
