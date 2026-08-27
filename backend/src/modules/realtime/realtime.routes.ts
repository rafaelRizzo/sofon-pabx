import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as RealtimeController from './realtime.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import { ListRealtimeExtensionsResponse, ListRealtimeTrunksResponse, ListRealtimeQueuesResponse } from './schemas/realtime.schema'
import { errors } from '../../schemas/responses'

const optionalCompanyQuery = z.object({ companyId: z.cuid2().optional() })

// Reaproveita as permissões já existentes de extensions/trunks/queues - sem recurso "realtime" novo
export const realtimeRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/realtime/extensions', {
        onRequest: [...protectedRoute, requirePermission('extensions', 'view')],
        schema: {
            tags: ['Realtime'],
            summary: 'Status ao vivo dos ramais',
            description: 'Presença (online/offline) e estado de chamada, populados via AMI. Filtra por empresa via ?companyId.',
            security: [{ bearerAuth: [] }],
            querystring: optionalCompanyQuery,
            response: {
                200: ListRealtimeExtensionsResponse,
                401: errors[401],
            },
        },
    }, RealtimeController.getExtensionsStatus as any)

    router.get('/realtime/trunks', {
        onRequest: [...protectedRoute, requirePermission('trunks', 'view')],
        schema: {
            tags: ['Realtime'],
            summary: 'Status ao vivo dos troncos',
            description: 'Presença (registrado/não) populada via AMI. Filtra por empresa via ?companyId.',
            security: [{ bearerAuth: [] }],
            querystring: optionalCompanyQuery,
            response: {
                200: ListRealtimeTrunksResponse,
                401: errors[401],
            },
        },
    }, RealtimeController.getTrunksStatus as any)

    router.get('/realtime/queues', {
        onRequest: [...protectedRoute, requirePermission('queues', 'view')],
        schema: {
            tags: ['Realtime'],
            summary: 'Status ao vivo das filas',
            description: 'Membros/agentes e chamadas em espera, populados via AMI. Filtra por empresa via ?companyId.',
            security: [{ bearerAuth: [] }],
            querystring: optionalCompanyQuery,
            response: {
                200: ListRealtimeQueuesResponse,
                401: errors[401],
            },
        },
    }, RealtimeController.getQueuesStatus as any)

    // Rotas de stream (SSE) abaixo: sem `response` no schema (a reply é hijackada, nunca passa por
    // reply.send/serializerCompiler) - cada uma empurra um novo snapshot só quando o realtime-bus
    // avisa que essa entidade mudou, substituindo o polling de 1s que os hooks do front faziam antes
    router.get('/realtime/extensions/stream', {
        onRequest: [...protectedRoute, requirePermission('extensions', 'view')],
        schema: {
            tags: ['Realtime'],
            summary: 'Stream (SSE) de status ao vivo dos ramais',
            security: [{ bearerAuth: [] }],
            querystring: optionalCompanyQuery,
            hide: true,
        },
    }, RealtimeController.streamExtensionsStatus)

    router.get('/realtime/trunks/stream', {
        onRequest: [...protectedRoute, requirePermission('trunks', 'view')],
        schema: {
            tags: ['Realtime'],
            summary: 'Stream (SSE) de status ao vivo dos troncos',
            security: [{ bearerAuth: [] }],
            querystring: optionalCompanyQuery,
            hide: true,
        },
    }, RealtimeController.streamTrunksStatus)

    router.get('/realtime/queues/stream', {
        onRequest: [...protectedRoute, requirePermission('queues', 'view')],
        schema: {
            tags: ['Realtime'],
            summary: 'Stream (SSE) de status ao vivo das filas',
            security: [{ bearerAuth: [] }],
            querystring: optionalCompanyQuery,
            hide: true,
        },
    }, RealtimeController.streamQueuesStatus)
}
