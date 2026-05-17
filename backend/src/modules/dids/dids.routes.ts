import { type FastifyInstance } from 'fastify'
import * as DidController from './dids.controller'
import { verifyAdmin, verifyToken } from '../../middlewares/auth.middleware'

export const didRoutes = async (app: FastifyInstance) => {
    app.get('/dids', { preHandler: verifyToken }, DidController.getDids)
    app.get('/dids/company/:company_id', { preHandler: verifyToken }, DidController.getDidsByCompany)
    app.get('/dids/:id', { preHandler: verifyToken }, DidController.getDidById)
    app.post('/dids', { preHandler: verifyToken }, DidController.createDid)
    app.put('/dids/:id', { preHandler: verifyToken }, DidController.updateDid)
    app.delete('/dids/:id', { preHandler: verifyToken }, DidController.deleteDid)
}
