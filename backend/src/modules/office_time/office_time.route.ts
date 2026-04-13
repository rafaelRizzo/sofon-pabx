import { type FastifyInstance } from 'fastify'
import * as OfficeTimeController from './office_time.controller'
import { verifyToken } from '../../middlewares/auth.middleware'

export async function officeTimeRoutes(app: FastifyInstance) {
    app.post('/office-times', { preHandler: verifyToken }, OfficeTimeController.createOfficeTime)
    app.get('/companies/:company_id/office-times', { preHandler: verifyToken }, OfficeTimeController.getOfficeTimesByCompany)
    app.get('/office-times/:id', { preHandler: verifyToken }, OfficeTimeController.getOfficeTimeById)
    app.get('/office-times/:id/status', { preHandler: verifyToken }, OfficeTimeController.getOfficeTimeStatus)
    app.put('/office-times/:id', { preHandler: verifyToken }, OfficeTimeController.updateOfficeTime)
    app.delete('/office-times/:id', { preHandler: verifyToken }, OfficeTimeController.deleteOfficeTime)
}