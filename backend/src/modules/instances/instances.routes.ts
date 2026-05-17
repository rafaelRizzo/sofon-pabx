import { type FastifyInstance } from 'fastify'
import * as InstanceController from './instances.controller'
import { verifyAdmin, verifyToken } from '../../middlewares/auth.middleware'

export const instanceRoutes = async (app: FastifyInstance) => {
    app.get('/instances', { preHandler: verifyToken }, InstanceController.getInstances)
    app.get('/instances/company/:company_id', { preHandler: verifyToken }, InstanceController.getInstancesByCompany)
    app.get('/instances/:id', { preHandler: verifyToken }, InstanceController.getInstanceById)
    app.post('/instances', { preHandler: verifyToken }, InstanceController.createInstance)
    app.put('/instances/:id', { preHandler: verifyToken }, InstanceController.updateInstance)
    app.delete('/instances/:id', { preHandler: verifyToken }, InstanceController.deleteInstance)
}
