import type { FastifyInstance } from 'fastify'
import * as QueueMembersController from './queue-members.controller'
import { protectedRoute } from '../../middleware/scope.middleware'

export const queueMembersRoutes = async (app: FastifyInstance) => {
    app.get('/queues/:id/members', { onRequest: protectedRoute }, QueueMembersController.getQueueMembers)
    app.post('/queues/:id/members', { onRequest: protectedRoute }, QueueMembersController.addMember)
    app.put('/queues/:id/members/:memberId', { onRequest: protectedRoute }, QueueMembersController.updateMember)
    app.delete('/queues/:id/members/:memberId', { onRequest: protectedRoute }, QueueMembersController.removeMember)
}
