import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as CompaniesController from './companies.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import {
    createCompanySchema, updateCompanySchema, idParamSchema, userIdParamSchema,
    ListCompaniesResponse, GetCompanyResponse, CreateCompanyResponse, UpdateCompanyResponse,
} from './schemas/company.schema'
import { errors, deleted } from '../../schemas/responses'

export const companiesRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/companies', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Companies'],
            summary: 'Listar empresas',
            description: 'Admin retorna todas; outros retornam apenas as próprias.',
            security: [{ bearerAuth: [] }],
            response: {
                200: ListCompaniesResponse,
                401: errors[401],
            },
        },
    }, CompaniesController.getAllCompanies as any)

    router.get('/companies/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Companies'],
            summary: 'Buscar empresa',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: GetCompanyResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, CompaniesController.getCompanyById as any)

    router.get('/companies/users/:id_user', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Companies'],
            summary: 'Listar empresas de um usuário',
            security: [{ bearerAuth: [] }],
            params: userIdParamSchema,
            response: {
                200: ListCompaniesResponse,
                401: errors[401],
                403: errors[403],
            },
        },
    }, CompaniesController.getCompaniesByUser as any)

    router.post('/companies', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Companies'],
            summary: 'Criar empresa',
            description: 'Requer role admin ou reseller.',
            security: [{ bearerAuth: [] }],
            body: createCompanySchema,
            response: {
                201: CreateCompanyResponse,
                401: errors[401],
                409: errors[409],
            },
        },
    }, CompaniesController.createCompany as any)

    router.put('/companies/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Companies'],
            summary: 'Atualizar empresa',
            description: 'Mínimo 1 campo obrigatório.',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateCompanySchema,
            response: {
                200: UpdateCompanyResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, CompaniesController.updateCompany as any)

    router.delete('/companies/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Companies'],
            summary: 'Remover empresa',
            description: 'Remove em cascade os DIDs associados. Requer role admin.',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, CompaniesController.deleteCompany as any)
}
