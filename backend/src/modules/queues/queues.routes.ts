import type { FastifyInstance } from 'fastify'
import * as QueuesController from './queues.controller'
import { protectedRoute } from '../../middleware/scope.middleware'

export const queuesRoutes = async (app: FastifyInstance) => {
    app.get('/queues', { onRequest: protectedRoute }, QueuesController.getQueues)
    app.get('/queues/company/:id_company', { onRequest: protectedRoute }, QueuesController.getQueuesByCompanyId)
    app.get('/queues/:id', { onRequest: protectedRoute }, QueuesController.getQueueById)
    app.get('/queues/:id/members', { onRequest: protectedRoute }, QueuesController.getQueueMembers)
    app.post('/queues', { onRequest: protectedRoute }, QueuesController.createQueue)
    app.post('/queues/:id/members', { onRequest: protectedRoute }, QueuesController.addMember)
    app.put('/queues/:id', { onRequest: protectedRoute }, QueuesController.updateQueue)
    app.put('/queues/:id/members/:memberId', { onRequest: protectedRoute }, QueuesController.updateMember)
    app.delete('/queues/:id', { onRequest: protectedRoute }, QueuesController.deleteQueue)
    app.delete('/queues/:id/members/:memberId', { onRequest: protectedRoute }, QueuesController.removeMember)
}
