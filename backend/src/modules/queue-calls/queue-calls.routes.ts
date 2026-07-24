import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as QueueCallsController from './queue-calls.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import {
    queueCallQuerySchema, queueCallMetricsQuerySchema, ListQueueCallsResponse, QueueCallMetricsResponse,
} from './schemas/queue-call.schema'
import { errors } from '../../schemas/responses'

export const queueCallsRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/queue-calls', {
        onRequest: [...protectedRoute, requirePermission('queue-calls', 'view')],
        schema: {
            tags: ['Queue Calls'],
            summary: 'Listar histórico de entradas em fila',
            description: 'Query obrigatória: ?companyId. Filtros opcionais: queueId, startDate, endDate (YYYY-MM-DD, cobrem o dia inteiro), outcome, agentExtensionId, limit (max 200), cursor (paginação por cursor, não offset).',
            security: [{ bearerAuth: [] }],
            querystring: queueCallQuerySchema,
            response: {
                200: ListQueueCallsResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, QueueCallsController.getQueueCalls as any)

    router.get('/queue-calls/metrics', {
        onRequest: [...protectedRoute, requirePermission('queue-calls', 'view')],
        schema: {
            tags: ['Queue Calls'],
            summary: 'Métricas agregadas de fila',
            description: 'Query obrigatória: ?companyId. Filtros opcionais: queueId, startDate, endDate, slaSeconds (default 20). Retorna ofertado/atendido/abandonado, taxa de abandono, SLA, tempo médio/mediano de espera, tempo médio de conversa e chamadas por agente.',
            security: [{ bearerAuth: [] }],
            querystring: queueCallMetricsQuerySchema,
            response: {
                200: QueueCallMetricsResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, QueueCallsController.getQueueCallMetrics as any)
}
