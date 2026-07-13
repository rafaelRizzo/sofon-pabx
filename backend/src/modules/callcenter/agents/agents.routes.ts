import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as AgentsController from './agents.controller'
import { protectedRoute } from '../../../middleware/scope.middleware'
import { requirePermission } from '../../../middleware/permission.middleware'
import {
    createAgentScopeSchema, updateAgentScopeSchema, idParamSchema, companyIdParamSchema,
    ListAgentScopesResponse, CreateAgentScopeResponse, UpdateAgentScopeResponse,
} from './schemas/agent-scope.schema'
import { errors, deleted } from '../../../schemas/responses'

export const callcenterAgentsRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/callcenter/agents/company/:id_company', {
        onRequest: [...protectedRoute, requirePermission('callcenter', 'view')],
        schema: {
            tags: ['Callcenter Agents'],
            summary: 'Listar elegibilidade agente×empresa',
            security: [{ bearerAuth: [] }],
            params: companyIdParamSchema,
            response: {
                200: ListAgentScopesResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, AgentsController.getScopesByCompanyId as any)

    router.post('/callcenter/agents', {
        onRequest: [...protectedRoute, requirePermission('callcenter', 'manage')],
        schema: {
            tags: ['Callcenter Agents'],
            summary: 'Vincular ramal a uma empresa (elegibilidade)',
            security: [{ bearerAuth: [] }],
            body: createAgentScopeSchema,
            response: {
                201: CreateAgentScopeResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, AgentsController.createScope as any)

    router.patch('/callcenter/agents/:id', {
        onRequest: [...protectedRoute, requirePermission('callcenter', 'manage')],
        schema: {
            tags: ['Callcenter Agents'],
            summary: 'Ativar/desativar elegibilidade',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateAgentScopeSchema,
            response: {
                200: UpdateAgentScopeResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, AgentsController.updateScope as any)

    router.delete('/callcenter/agents/:id', {
        onRequest: [...protectedRoute, requirePermission('callcenter', 'manage')],
        schema: {
            tags: ['Callcenter Agents'],
            summary: 'Remover elegibilidade',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, AgentsController.deleteScope as any)
}
