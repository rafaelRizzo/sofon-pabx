import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as RoutingRulesController from './routing-rules.controller'
import { protectedRoute } from '../../../middleware/scope.middleware'
import { requirePermission } from '../../../middleware/permission.middleware'
import {
    createRoutingRuleSchema, updateRoutingRuleSchema, idParamSchema, companyIdParamSchema,
    ListRoutingRulesResponse, GetRoutingRuleResponse, CreateRoutingRuleResponse, UpdateRoutingRuleResponse,
} from './schemas/routing-rule.schema'
import { errors, deleted } from '../../../schemas/responses'

export const routingRulesRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/callcenter/routing-rules/company/:id_company', {
        onRequest: [...protectedRoute, requirePermission('callcenter', 'view')],
        schema: {
            tags: ['Callcenter Routing Rules'],
            summary: 'Listar regras de prioridade por empresa',
            security: [{ bearerAuth: [] }],
            params: companyIdParamSchema,
            response: {
                200: ListRoutingRulesResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, RoutingRulesController.getRoutingRulesByCompanyId as any)

    router.get('/callcenter/routing-rules/:id', {
        onRequest: [...protectedRoute, requirePermission('callcenter', 'view')],
        schema: {
            tags: ['Callcenter Routing Rules'],
            summary: 'Buscar regra de prioridade',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: GetRoutingRuleResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, RoutingRulesController.getRoutingRuleById as any)

    router.post('/callcenter/routing-rules', {
        onRequest: [...protectedRoute, requirePermission('callcenter', 'manage')],
        schema: {
            tags: ['Callcenter Routing Rules'],
            summary: 'Criar regra de prioridade',
            security: [{ bearerAuth: [] }],
            body: createRoutingRuleSchema,
            response: {
                201: CreateRoutingRuleResponse,
                401: errors[401],
                403: errors[403],
                409: errors[409],
            },
        },
    }, RoutingRulesController.createRoutingRule as any)

    router.put('/callcenter/routing-rules/:id', {
        onRequest: [...protectedRoute, requirePermission('callcenter', 'manage')],
        schema: {
            tags: ['Callcenter Routing Rules'],
            summary: 'Atualizar regra de prioridade',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateRoutingRuleSchema,
            response: {
                200: UpdateRoutingRuleResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, RoutingRulesController.updateRoutingRule as any)

    router.delete('/callcenter/routing-rules/:id', {
        onRequest: [...protectedRoute, requirePermission('callcenter', 'manage')],
        schema: {
            tags: ['Callcenter Routing Rules'],
            summary: 'Remover regra de prioridade',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, RoutingRulesController.deleteRoutingRule as any)
}
