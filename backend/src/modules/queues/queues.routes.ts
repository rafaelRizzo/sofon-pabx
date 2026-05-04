import { type FastifyInstance } from 'fastify'
import * as QueueController from './queues.controller'
import { verifyToken } from '../../middlewares/auth.middleware'

export async function queueRoutes(app: FastifyInstance) {
    app.get('/queues', { preHandler: verifyToken }, QueueController.getQueues)
    app.get('/queues/:id', { preHandler: verifyToken }, QueueController.getQueueById)
    app.get('/companies/:companyId/queues', { preHandler: verifyToken }, QueueController.getCompanyQueues)
    app.post('/queues', { preHandler: verifyToken }, QueueController.createQueue)
    app.put('/queues/:id', { preHandler: verifyToken }, QueueController.updateQueue)
    app.delete('/queues/:id', { preHandler: verifyToken }, QueueController.deleteQueue)

    // Queue Members
    app.get('/queues/:queueId/members', { preHandler: verifyToken }, QueueController.getQueueMembers)
    app.post('/queues/:queueId/members', { preHandler: verifyToken }, QueueController.addQueueMember)
    app.put('/queues/:queueId/members/:memberId', { preHandler: verifyToken }, QueueController.updateQueueMember)
    app.delete('/queues/:queueId/members/:memberId', { preHandler: verifyToken }, QueueController.removeQueueMember)
}
