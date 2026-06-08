import type { FastifyInstance } from 'fastify'
import * as DidsController from './dids.controller'
import { authMiddleware } from '../../middleware/auth.middleware'

export const didsRoutes = async (app: FastifyInstance) => {
    app.get('/dids', { onRequest: authMiddleware }, DidsController.getDids)
    app.get('/dids/:id', { onRequest: authMiddleware }, DidsController.getDidById)
    app.get('/dids/company/:id_company', { onRequest: authMiddleware }, DidsController.getDidsByCompanyId)
    app.post('/dids', { onRequest: authMiddleware }, DidsController.createDid)
    app.put('/dids/:id', { onRequest: authMiddleware }, DidsController.updateDid)
    app.delete('/dids/:id', { onRequest: authMiddleware }, DidsController.deleteDid)
}
