import type { FastifyInstance } from 'fastify'
import * as DidsController from './dids.controller'
import { protectedRoute } from '../../middleware/scope.middleware'

export const didsRoutes = async (app: FastifyInstance) => {
    app.get('/dids', { onRequest: protectedRoute }, DidsController.getDids)
    app.get('/dids/:id', { onRequest: protectedRoute }, DidsController.getDidById)
    app.get('/dids/company/:id_company', { onRequest: protectedRoute }, DidsController.getDidsByCompanyId)
    app.post('/dids', { onRequest: protectedRoute }, DidsController.createDid)
    app.put('/dids/:id', { onRequest: protectedRoute }, DidsController.updateDid)
    app.delete('/dids/:id', { onRequest: protectedRoute }, DidsController.deleteDid)
}
