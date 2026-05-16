import { type FastifyInstance } from 'fastify'
import * as PlanController from './plans.controller'
import { verifyAdmin, verifyToken } from '../../middlewares/auth.middleware'

export const planRoutes = async (app: FastifyInstance) => {
    app.get('/plans', { preHandler: verifyToken }, PlanController.getPlans)
    app.get('/plans/:id', { preHandler: verifyToken }, PlanController.getPlanById)
    app.post('/plans', { preHandler: verifyAdmin }, PlanController.createPlan)
    app.put('/plans/:id', { preHandler: verifyAdmin }, PlanController.updatePlan)
    app.delete('/plans/:id', { preHandler: verifyAdmin }, PlanController.deletePlan)
}
