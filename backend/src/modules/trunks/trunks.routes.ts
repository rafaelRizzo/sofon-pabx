import type { FastifyInstance } from 'fastify'
import * as TrunksController from './trunks.controller'
import { protectedRoute } from '../../middleware/scope.middleware'

export const trunksRoutes = async (app: FastifyInstance) => {
    app.get('/trunks', { onRequest: protectedRoute }, TrunksController.getTrunks)
    app.get('/trunks/:id', { onRequest: protectedRoute }, TrunksController.getTrunkById)
    app.post('/trunks', { onRequest: protectedRoute }, TrunksController.createTrunk)
    app.put('/trunks/:id', { onRequest: protectedRoute }, TrunksController.updateTrunk)
    app.delete('/trunks/:id', { onRequest: protectedRoute }, TrunksController.deleteTrunk)
}
