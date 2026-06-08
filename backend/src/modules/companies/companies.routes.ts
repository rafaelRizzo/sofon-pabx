import type { FastifyInstance } from 'fastify'
import * as CompaniesController from './companies.controller'
import { authMiddleware } from '../../middleware/auth.middleware'

export const companiesRoutes = async (app: FastifyInstance) => {
    app.get('/companies', { onRequest: authMiddleware }, CompaniesController.getAllCompanies)
    app.get('/companies/:id', { onRequest: authMiddleware }, CompaniesController.getCompanyById)
    app.get('/companies/users/:id_user', { onRequest: authMiddleware }, CompaniesController.getCompaniesByUser)
    app.post('/companies', { onRequest: authMiddleware }, CompaniesController.createCompany)
    app.put('/companies/:id', { onRequest: authMiddleware }, CompaniesController.updateCompany)
    app.delete('/companies/:id', { onRequest: authMiddleware }, CompaniesController.deleteCompany)
}
