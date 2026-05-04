import { type FastifyInstance } from 'fastify'
import * as CompanyController from './companies.controller'
import { verifyAdmin, verifyToken } from '../../middlewares/auth.middleware'

export async function companyRoutes(app: FastifyInstance) {
    app.get('/companies', { preHandler: verifyToken }, CompanyController.getCompanies)
    app.get('/companies/:id', { preHandler: verifyToken }, CompanyController.getCompanyById)
    app.post('/companies', { preHandler: verifyAdmin }, CompanyController.createCompany)
    app.put('/companies/:id', { preHandler: verifyAdmin }, CompanyController.updateCompany)
    app.delete('/companies/:id', { preHandler: verifyAdmin }, CompanyController.deleteCompany)
}
