import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as VariableCatalogController from './variable-catalog.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import {
    createVariableSchema, updateVariableSchema, idParamSchema, companyQuerySchema,
    ListVariablesResponse, GetVariableResponse, CreateVariableResponse, UpdateVariableResponse,
} from './schemas/variable-catalog.schema'
import { errors, deleted } from '../../schemas/responses'

export const variableCatalogRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/variable-catalog', {
        onRequest: [...protectedRoute, requirePermission('variable-catalog', 'view')],
        schema: {
            tags: ['Variable Catalog'],
            summary: 'Listar variáveis declaradas da empresa',
            security: [{ bearerAuth: [] }],
            querystring: companyQuerySchema,
            response: {
                200: ListVariablesResponse,
                401: errors[401],
                403: errors[403],
            },
        },
    }, VariableCatalogController.getVariablesByCompanyId as any)

    router.get('/variable-catalog/:id', {
        onRequest: [...protectedRoute, requirePermission('variable-catalog', 'view')],
        schema: {
            tags: ['Variable Catalog'],
            summary: 'Buscar variável declarada',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: GetVariableResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, VariableCatalogController.getVariableById as any)

    router.post('/variable-catalog', {
        onRequest: [...protectedRoute, requirePermission('variable-catalog', 'manage')],
        schema: {
            tags: ['Variable Catalog'],
            summary: 'Declarar variável nova',
            description: 'Nome de variável de canal validado por outros módulos (URA modo coleta, Definir Variável) ao referenciar por nome - ver assertVariableExistsForCompany.',
            security: [{ bearerAuth: [] }],
            body: createVariableSchema,
            response: {
                201: CreateVariableResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, VariableCatalogController.createVariable as any)

    router.put('/variable-catalog/:id', {
        onRequest: [...protectedRoute, requirePermission('variable-catalog', 'manage')],
        schema: {
            tags: ['Variable Catalog'],
            summary: 'Atualizar variável declarada',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateVariableSchema,
            response: {
                200: UpdateVariableResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, VariableCatalogController.updateVariable as any)

    router.delete('/variable-catalog/:id', {
        onRequest: [...protectedRoute, requirePermission('variable-catalog', 'manage')],
        schema: {
            tags: ['Variable Catalog'],
            summary: 'Remover variável declarada',
            description: 'Bloqueado com 409 se a variável estiver em uso por alguma URA ou Definir Variável.',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, VariableCatalogController.deleteVariable as any)
}
