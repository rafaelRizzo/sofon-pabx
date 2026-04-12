import { type FastifyInstance } from 'fastify'
import * as CompanyController from './companies.controller'
import { verifyAdmin, verifyToken } from '../../middlewares/auth.middleware'

export async function companyRoutes(app: FastifyInstance) {
    app.get('/companies', { preHandler: verifyAdmin }, CompanyController.getCompanies)
    app.get('/companies/me', { preHandler: verifyToken }, CompanyController.getMyCompanies)
    app.get('/companies/:id', { preHandler: verifyToken }, CompanyController.getCompanyById)
    app.post('/companies', { preHandler: verifyToken }, CompanyController.createCompany)
    app.put('/companies/:id', { preHandler: verifyToken }, CompanyController.updateCompany)
    app.delete('/companies/:id', { preHandler: verifyAdmin }, CompanyController.deleteCompany)
    app.post('/companies/:id/members', { preHandler: verifyToken }, CompanyController.addMember)
    app.delete('/companies/:id/members/:user_id', { preHandler: verifyToken }, CompanyController.removeMember)
}