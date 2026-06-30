import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as QueuesController from './queues.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { createQueueSchema, updateQueueSchema, idParamSchema, companyIdParamSchema } from './schemas/queue.schema'
import { errors, ok, deleted } from '../../schemas/responses'
import { QueueSchema } from './schemas/queue.schema'

const optionalCompanyQuery = z.object({ companyId: z.cuid2().optional() })

export const queuesRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/queues', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Queues'],
            summary: 'Listar filas',
            description: 'Filtra por empresa via ?companyId.',
            security: [{ bearerAuth: [] }],
            querystring: optionalCompanyQuery,
            response: {
                200: ok({ message: z.string(), queues: z.array(QueueSchema) }),
                401: errors[401],
            },
        },
    }, QueuesController.getQueues as any)

    router.get('/queues/company/:id_company', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Queues'],
            summary: 'Listar filas por empresa',
            security: [{ bearerAuth: [] }],
            params: companyIdParamSchema,
            response: {
                200: ok({ message: z.string(), queues: z.array(QueueSchema) }),
                401: errors[401],
                403: errors[403],
            },
        },
    }, QueuesController.getQueuesByCompanyId as any)

    router.get('/queues/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Queues'],
            summary: 'Buscar fila',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: ok({ message: z.string(), queue: QueueSchema }),
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, QueuesController.getQueueById as any)

    router.post('/queues', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Queues'],
            summary: 'Criar fila',
            security: [{ bearerAuth: [] }],
            body: createQueueSchema,
            response: {
                201: ok({ message: z.string(), queueId: z.string() }),
                401: errors[401],
                403: errors[403],
                409: errors[409],
            },
        },
    }, QueuesController.createQueue as any)

    router.put('/queues/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Queues'],
            summary: 'Atualizar fila',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateQueueSchema,
            response: {
                200: ok({ message: z.string() }),
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, QueuesController.updateQueue as any)

    router.delete('/queues/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Queues'],
            summary: 'Remover fila',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, QueuesController.deleteQueue as any)
}
