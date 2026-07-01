import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as InboundRoutesController from './inbound-routes.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import {
    createInboundRouteSchema, updateInboundRouteSchema, idParamSchema, companyQuerySchema,
    ListInboundRoutesResponse, GetInboundRouteResponse, CreateInboundRouteResponse, UpdateInboundRouteResponse,
} from './schemas/inbound-route.schema'
import { errors, deleted } from '../../schemas/responses'

export const inboundRoutesRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/inbound-routes', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Inbound Routes'],
            summary: 'Listar rotas de entrada por empresa',
            security: [{ bearerAuth: [] }],
            querystring: companyQuerySchema,
            response: {
                200: ListInboundRoutesResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, InboundRoutesController.getInboundRoutesByCompanyId as any)

    router.get('/inbound-routes/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Inbound Routes'],
            summary: 'Buscar rota de entrada',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: GetInboundRouteResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, InboundRoutesController.getInboundRouteById as any)

    router.post('/inbound-routes', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Inbound Routes'],
            summary: 'Criar rota de entrada',
            security: [{ bearerAuth: [] }],
            body: createInboundRouteSchema,
            response: {
                201: CreateInboundRouteResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, InboundRoutesController.createInboundRoute as any)

    router.put('/inbound-routes/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Inbound Routes'],
            summary: 'Atualizar rota de entrada',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateInboundRouteSchema,
            response: {
                200: UpdateInboundRouteResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, InboundRoutesController.updateInboundRoute as any)

    router.delete('/inbound-routes/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Inbound Routes'],
            summary: 'Remover rota de entrada',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, InboundRoutesController.deleteInboundRoute as any)
}
