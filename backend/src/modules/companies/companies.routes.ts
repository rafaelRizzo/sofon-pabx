import type { FastifyInstance } from 'fastify'
import * as CompaniesController from './companies.controller'
import { protectedRoute } from '../../middleware/scope.middleware'

export const companiesRoutes = async (app: FastifyInstance) => {
    app.get('/companies', { onRequest: protectedRoute }, CompaniesController.getAllCompanies)
    app.get('/companies/:id', { onRequest: protectedRoute }, CompaniesController.getCompanyById)
    app.get('/companies/users/:id_user', { onRequest: protectedRoute }, CompaniesController.getCompaniesByUser)
    app.post('/companies', { onRequest: protectedRoute }, CompaniesController.createCompany)
    app.put('/companies/:id', { onRequest: protectedRoute }, CompaniesController.updateCompany)
    app.delete('/companies/:id', { onRequest: protectedRoute }, CompaniesController.deleteCompany)
}
