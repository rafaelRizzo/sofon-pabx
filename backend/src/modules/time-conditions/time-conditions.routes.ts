import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as TimeConditionsController from './time-conditions.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import {
    createTimeConditionSchema, updateTimeConditionSchema, idParamSchema, companyQuerySchema,
    ListTimeConditionsResponse, GetTimeConditionResponse, CreateTimeConditionResponse, UpdateTimeConditionResponse,
} from './schemas/time-condition.schema'
import { errors, deleted } from '../../schemas/responses'

const optionalCompanyQuery = z.object({ companyId: z.cuid2().optional() })

export const timeConditionsRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/time-conditions', {
        onRequest: [...protectedRoute, requirePermission('time-conditions', 'view')],
        schema: {
            tags: ['Time Conditions'],
            summary: 'Listar condições de horário',
            description: 'Filtra por empresa via ?companyId.',
            security: [{ bearerAuth: [] }],
            querystring: optionalCompanyQuery,
            response: {
                200: ListTimeConditionsResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, TimeConditionsController.getTimeConditionsByCompanyId as any)

    router.get('/time-conditions/:id', {
        onRequest: [...protectedRoute, requirePermission('time-conditions', 'view')],
        schema: {
            tags: ['Time Conditions'],
            summary: 'Buscar condição de horário',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: GetTimeConditionResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, TimeConditionsController.getTimeConditionById as any)

    router.post('/time-conditions', {
        onRequest: [...protectedRoute, requirePermission('time-conditions', 'manage')],
        schema: {
            tags: ['Time Conditions'],
            summary: 'Criar condição de horário',
            security: [{ bearerAuth: [] }],
            body: createTimeConditionSchema,
            response: {
                201: CreateTimeConditionResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, TimeConditionsController.createTimeCondition as any)

    router.put('/time-conditions/:id', {
        onRequest: [...protectedRoute, requirePermission('time-conditions', 'manage')],
        schema: {
            tags: ['Time Conditions'],
            summary: 'Atualizar condição de horário',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateTimeConditionSchema,
            response: {
                200: UpdateTimeConditionResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, TimeConditionsController.updateTimeCondition as any)

    router.delete('/time-conditions/:id', {
        onRequest: [...protectedRoute, requirePermission('time-conditions', 'manage')],
        schema: {
            tags: ['Time Conditions'],
            summary: 'Remover condição de horário',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, TimeConditionsController.deleteTimeCondition as any)
}
