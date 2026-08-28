import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as FormatterNodesController from './formatter-nodes.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import {
    createFormatterNodeSchema, updateFormatterNodeSchema, idParamSchema, optionalCompanyQuery,
    ListFormatterNodesResponse, GetFormatterNodeResponse, CreateFormatterNodeResponse, UpdateFormatterNodeResponse,
} from './schemas/formatter-node.schema'
import { errors, deleted } from '../../schemas/responses'

export const formatterNodesRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/formatter-nodes', {
        onRequest: [...protectedRoute, requirePermission('formatter', 'view')],
        schema: {
            tags: ['Formatters'],
            summary: 'Listar nós Formatter por empresa',
            security: [{ bearerAuth: [] }],
            querystring: optionalCompanyQuery,
            response: {
                200: ListFormatterNodesResponse,
                401: errors[401],
                403: errors[403],
            },
        },
    }, FormatterNodesController.getFormatterNodes as any)

    router.get('/formatter-nodes/:id', {
        onRequest: [...protectedRoute, requirePermission('formatter', 'view')],
        schema: {
            tags: ['Formatters'],
            summary: 'Buscar nó Formatter',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: GetFormatterNodeResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, FormatterNodesController.getFormatterNodeById as any)

    router.post('/formatter-nodes', {
        onRequest: [...protectedRoute, requirePermission('formatter', 'manage')],
        schema: {
            tags: ['Formatters'],
            summary: 'Criar nó Formatter',
            description:
                'Nó de formatação de variável de canal via máscara, executado em tempo de chamada via AGI ' +
                'quando referenciado como destino de rota (type: "formatter"). Lê inputVariable, tenta cada ' +
                'máscara de `masks` em ordem (primeira cujo tamanho bate com o valor limpo) e grava o resultado ' +
                'em outputVariable. Legenda de máscara: "0"=dígito, "A"=letra, "*"=alfanumérico, demais ' +
                'caracteres são literais.',
            security: [{ bearerAuth: [] }],
            body: createFormatterNodeSchema,
            response: {
                201: CreateFormatterNodeResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, FormatterNodesController.createFormatterNode as any)

    router.put('/formatter-nodes/:id', {
        onRequest: [...protectedRoute, requirePermission('formatter', 'manage')],
        schema: {
            tags: ['Formatters'],
            summary: 'Atualizar nó Formatter',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateFormatterNodeSchema,
            response: {
                200: UpdateFormatterNodeResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, FormatterNodesController.updateFormatterNode as any)

    router.delete('/formatter-nodes/:id', {
        onRequest: [...protectedRoute, requirePermission('formatter', 'manage')],
        schema: {
            tags: ['Formatters'],
            summary: 'Remover nó Formatter',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, FormatterNodesController.deleteFormatterNode as any)
}
