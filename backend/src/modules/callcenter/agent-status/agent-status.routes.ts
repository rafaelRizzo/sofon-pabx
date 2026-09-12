import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as AgentStatusController from './agent-status.controller'
import { protectedRoute } from '../../../middleware/scope.middleware'
import { setAgentStatusSchema, GetAgentStatusResponse, SetAgentStatusResponse } from './schemas/agent-status.schema'
import { errors } from '../../../schemas/responses'

export const agentStatusRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/callcenter/agent-status/me', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Callcenter Agent Status'],
            summary: 'Status de pausa do usuário logado (agregado por todas as filas)',
            description: 'Sem gate de permissão de callcenter - é identidade/self-service, não CRUD de terceiro.',
            security: [{ bearerAuth: [] }],
            response: {
                200: GetAgentStatusResponse,
                401: errors[401],
                404: errors[404],
            },
        },
    }, AgentStatusController.getMyStatus as any)

    router.put('/callcenter/agent-status/me', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Callcenter Agent Status'],
            summary: 'Pausar/retomar o usuário logado em todas as filas de uma vez',
            security: [{ bearerAuth: [] }],
            body: setAgentStatusSchema,
            response: {
                200: SetAgentStatusResponse,
                400: errors[400],
                401: errors[401],
                404: errors[404],
            },
        },
    }, AgentStatusController.setMyStatus as any)
}
