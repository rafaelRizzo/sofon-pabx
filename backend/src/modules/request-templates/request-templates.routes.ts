import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as RequestTemplatesController from './request-templates.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import {
    createRequestTemplateSchema, updateRequestTemplateSchema, idParamSchema, optionalCompanyQuery,
    ListRequestTemplatesResponse, GetRequestTemplateResponse, CreateRequestTemplateResponse, UpdateRequestTemplateResponse,
} from './schemas/request-template.schema'
import { errors, deleted } from '../../schemas/responses'

export const requestTemplatesRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/request-templates', {
        onRequest: [...protectedRoute, requirePermission('request-templates', 'view')],
        schema: {
            tags: ['Request Templates'],
            summary: 'Listar request templates por empresa',
            security: [{ bearerAuth: [] }],
            querystring: optionalCompanyQuery,
            response: {
                200: ListRequestTemplatesResponse,
                401: errors[401],
                403: errors[403],
            },
        },
    }, RequestTemplatesController.getRequestTemplates as any)

    router.get('/request-templates/:id', {
        onRequest: [...protectedRoute, requirePermission('request-templates', 'view')],
        schema: {
            tags: ['Request Templates'],
            summary: 'Buscar request template',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: GetRequestTemplateResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, RequestTemplatesController.getRequestTemplateById as any)

    router.post('/request-templates', {
        onRequest: [...protectedRoute, requirePermission('request-templates', 'manage')],
        schema: {
            tags: ['Request Templates'],
            summary: 'Criar request template',
            description:
                'Template de requisição HTTP síncrona, executada em tempo de chamada via AGI quando referenciado ' +
                'como destino de rota (type: "request"). url/headers/body aceitam placeholders {{VAR}} resolvidos ' +
                'via AGI GET VARIABLE (ex: {{CALLERID(num)}}, {{EXTEN}}). variableMappings extrai campos do JSON de ' +
                'resposta (ex: path "data.client[0].id") para variáveis de canal, disponíveis no dialplan após o request.',
            security: [{ bearerAuth: [] }],
            body: createRequestTemplateSchema,
            response: {
                201: CreateRequestTemplateResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, RequestTemplatesController.createRequestTemplate as any)

    router.put('/request-templates/:id', {
        onRequest: [...protectedRoute, requirePermission('request-templates', 'manage')],
        schema: {
            tags: ['Request Templates'],
            summary: 'Atualizar request template',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateRequestTemplateSchema,
            response: {
                200: UpdateRequestTemplateResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, RequestTemplatesController.updateRequestTemplate as any)

    router.delete('/request-templates/:id', {
        onRequest: [...protectedRoute, requirePermission('request-templates', 'manage')],
        schema: {
            tags: ['Request Templates'],
            summary: 'Remover request template',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, RequestTemplatesController.deleteRequestTemplate as any)
}
