import type { FastifyInstance } from 'fastify'
import * as QueuesController from './queues.controller'
import { protectedRoute } from '../../middleware/scope.middleware'

export const queuesRoutes = async (app: FastifyInstance) => {
    app.get('/queues', { onRequest: protectedRoute }, QueuesController.getQueues)
    app.get('/queues/company/:id_company', { onRequest: protectedRoute }, QueuesController.getQueuesByCompanyId)
    app.get('/queues/:id', { onRequest: protectedRoute }, QueuesController.getQueueById)
    app.post('/queues', { onRequest: protectedRoute }, QueuesController.createQueue)
    app.put('/queues/:id', { onRequest: protectedRoute }, QueuesController.updateQueue)
    app.delete('/queues/:id', { onRequest: protectedRoute }, QueuesController.deleteQueue)
}
