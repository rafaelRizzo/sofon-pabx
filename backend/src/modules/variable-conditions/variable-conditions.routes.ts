import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as VariableConditionsController from './variable-conditions.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import {
    createVariableConditionSchema, updateVariableConditionSchema, idParamSchema,
    ListVariableConditionsResponse, GetVariableConditionResponse, CreateVariableConditionResponse, UpdateVariableConditionResponse,
} from './schemas/variable-condition.schema'
import { errors, deleted } from '../../schemas/responses'

const optionalCompanyQuery = z.object({ companyId: z.cuid2().optional() })

export const variableConditionsRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/variable-conditions', {
        onRequest: [...protectedRoute, requirePermission('variable-conditions', 'view')],
        schema: {
            tags: ['Variable Conditions'],
            summary: 'Listar condições de variável',
            description: 'Filtra por empresa via ?companyId.',
            security: [{ bearerAuth: [] }],
            querystring: optionalCompanyQuery,
            response: {
                200: ListVariableConditionsResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, VariableConditionsController.getVariableConditionsByCompanyId as any)

    router.get('/variable-conditions/:id', {
        onRequest: [...protectedRoute, requirePermission('variable-conditions', 'view')],
        schema: {
            tags: ['Variable Conditions'],
            summary: 'Buscar condição de variável',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: GetVariableConditionResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, VariableConditionsController.getVariableConditionById as any)

    router.post('/variable-conditions', {
        onRequest: [...protectedRoute, requirePermission('variable-conditions', 'manage')],
        schema: {
            tags: ['Variable Conditions'],
            summary: 'Criar condição de variável',
            description: 'Valida variável(is) de canal (preenchida, tamanho, igualdade, regex, numérica) e direciona por trueRoute/falseRoute — usável como RouteDestination (type: "variable-condition") em qualquer fluxo.',
            security: [{ bearerAuth: [] }],
            body: createVariableConditionSchema,
            response: {
                201: CreateVariableConditionResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, VariableConditionsController.createVariableCondition as any)

    router.put('/variable-conditions/:id', {
        onRequest: [...protectedRoute, requirePermission('variable-conditions', 'manage')],
        schema: {
            tags: ['Variable Conditions'],
            summary: 'Atualizar condição de variável',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateVariableConditionSchema,
            response: {
                200: UpdateVariableConditionResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, VariableConditionsController.updateVariableCondition as any)

    router.delete('/variable-conditions/:id', {
        onRequest: [...protectedRoute, requirePermission('variable-conditions', 'manage')],
        schema: {
            tags: ['Variable Conditions'],
            summary: 'Remover condição de variável',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, VariableConditionsController.deleteVariableCondition as any)
}
