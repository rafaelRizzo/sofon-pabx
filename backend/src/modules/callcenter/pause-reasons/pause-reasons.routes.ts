import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as PauseReasonsController from './pause-reasons.controller'
import { protectedRoute } from '../../../middleware/scope.middleware'
import { requirePermission } from '../../../middleware/permission.middleware'
import {
    createPauseReasonSchema, updatePauseReasonSchema, idParamSchema, companyIdParamSchema,
    ListPauseReasonsResponse, CreatePauseReasonResponse, UpdatePauseReasonResponse,
} from './schemas/pause-reason.schema'
import { errors, deleted } from '../../../schemas/responses'

export const pauseReasonsRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/callcenter/pause-reasons/company/:id_company', {
        onRequest: [...protectedRoute, requirePermission('callcenter', 'view')],
        schema: {
            tags: ['Callcenter Pause Reasons'],
            summary: 'Listar motivos de pausa da empresa',
            security: [{ bearerAuth: [] }],
            params: companyIdParamSchema,
            response: {
                200: ListPauseReasonsResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, PauseReasonsController.getPauseReasonsByCompanyId as any)

    router.post('/callcenter/pause-reasons', {
        onRequest: [...protectedRoute, requirePermission('callcenter', 'manage')],
        schema: {
            tags: ['Callcenter Pause Reasons'],
            summary: 'Criar motivo de pausa',
            security: [{ bearerAuth: [] }],
            body: createPauseReasonSchema,
            response: {
                201: CreatePauseReasonResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, PauseReasonsController.createPauseReason as any)

    router.patch('/callcenter/pause-reasons/:id', {
        onRequest: [...protectedRoute, requirePermission('callcenter', 'manage')],
        schema: {
            tags: ['Callcenter Pause Reasons'],
            summary: 'Atualizar motivo de pausa',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updatePauseReasonSchema,
            response: {
                200: UpdatePauseReasonResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, PauseReasonsController.updatePauseReason as any)

    router.delete('/callcenter/pause-reasons/:id', {
        onRequest: [...protectedRoute, requirePermission('callcenter', 'manage')],
        schema: {
            tags: ['Callcenter Pause Reasons'],
            summary: 'Remover motivo de pausa',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, PauseReasonsController.deletePauseReason as any)
}
