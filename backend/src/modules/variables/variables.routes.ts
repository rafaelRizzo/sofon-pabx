import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as VariablesController from './variables.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import {
    createVariableSetSchema, updateVariableSetSchema, idParamSchema,
    ListVariableSetsResponse, GetVariableSetResponse, CreateVariableSetResponse, UpdateVariableSetResponse,
} from './schemas/variable.schema'
import { errors, deleted } from '../../schemas/responses'

const optionalCompanyQuery = z.object({ companyId: z.cuid2().optional() })

export const variablesRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/variables', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Variables'],
            summary: 'Listar variable sets',
            description: 'Filtra por empresa via ?companyId.',
            security: [{ bearerAuth: [] }],
            querystring: optionalCompanyQuery,
            response: {
                200: ListVariableSetsResponse,
                401: errors[401],
                403: errors[403],
            },
        },
    }, VariablesController.getVariableSets as any)

    router.get('/variables/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Variables'],
            summary: 'Buscar variable set',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: GetVariableSetResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, VariablesController.getVariableSetById as any)

    router.post('/variables', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Variables'],
            summary: 'Criar variable set',
            description: 'Seta 1+ variáveis de canal (Set) e segue pro destino configurado — usável como RouteDestination (type: "variable-set") em qualquer fluxo.',
            security: [{ bearerAuth: [] }],
            body: createVariableSetSchema,
            response: {
                201: CreateVariableSetResponse,
                401: errors[401],
                403: errors[403],
                409: errors[409],
            },
        },
    }, VariablesController.createVariableSet as any)

    router.patch('/variables/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Variables'],
            summary: 'Atualizar variable set',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateVariableSetSchema,
            response: {
                200: UpdateVariableSetResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, VariablesController.updateVariableSet as any)

    router.delete('/variables/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Variables'],
            summary: 'Remover variable set',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, VariablesController.deleteVariableSet as any)
}
