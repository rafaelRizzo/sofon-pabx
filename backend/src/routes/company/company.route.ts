import type { FastifyInstance } from 'fastify'
import { authMiddleware, adminMiddleware } from '../../middlewares/middleware.auth'
import {
    createCompanySchema,
    updateCompanySchema,
    getCompanySchema,
    deleteCompanySchema
} from './schema/company.schema'
import { CompanyController } from '../../controllers/company/company.controller'

export const companyRoutes = async (fastify: FastifyInstance) => {
    const authAdmin = { preHandler: authMiddleware, adminMiddleware }

    fastify.post(
        '/companies',
        { ...authAdmin, schema: createCompanySchema },
        (request, reply) => new CompanyController(request, reply).create()
    )

    fastify.get(
        '/companies',
        authAdmin,
        (request, reply) => new CompanyController(request, reply).list()
    )

    fastify.get(
        '/companies/:id',
        { ...authAdmin, schema: getCompanySchema },
        (request, reply) => new CompanyController(request, reply).getById()
    )

    fastify.put(
        '/companies/:id',
        { ...authAdmin, schema: updateCompanySchema },
        (request, reply) => new CompanyController(request, reply).update()
    )

    fastify.delete(
        '/companies/:id',
        { ...authAdmin, schema: deleteCompanySchema },
        (request, reply) => new CompanyController(request, reply).delete()
    )
}
