import { type FastifyInstance } from 'fastify'
import * as TrunkController from './trunks.controller'
import { verifyToken } from '../../middlewares/auth.middleware'

export const trunkRoutes = async (app: FastifyInstance) => {
    app.get('/trunks', { preHandler: verifyToken }, TrunkController.getTrunks)
    app.get('/trunks/:id', { preHandler: verifyToken }, TrunkController.getTrunkById)
    app.get('/companies/:companyId/trunks', { preHandler: verifyToken }, TrunkController.getCompanyTrunks)
    app.post('/trunks', { preHandler: verifyToken }, TrunkController.createTrunk)
    app.put('/trunks/:id', { preHandler: verifyToken }, TrunkController.updateTrunk)
    app.delete('/trunks/:id', { preHandler: verifyToken }, TrunkController.deleteTrunk)
}
