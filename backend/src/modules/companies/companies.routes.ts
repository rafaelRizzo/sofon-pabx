import { type FastifyInstance } from 'fastify'
import * as CompanyController from './companies.controller'
import { verifyAdmin, verifyToken } from '../../middlewares/auth.middleware'

export const companyRoutes = async (app: FastifyInstance) => {
    app.get('/companies', { preHandler: verifyToken }, CompanyController.getCompanies)
    app.get('/companies/:id', { preHandler: verifyToken }, CompanyController.getCompanyById)
    app.post('/companies', { preHandler: verifyToken }, CompanyController.createCompany)
    app.put('/companies/:id', { preHandler: verifyToken }, CompanyController.updateCompany)
    app.delete('/companies/:id', { preHandler: verifyToken }, CompanyController.deleteCompany)
}
