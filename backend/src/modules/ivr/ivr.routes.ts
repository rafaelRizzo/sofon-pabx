import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as IvrController from './ivr.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import {
    createIvrMenuSchema, updateIvrMenuSchema, idParamSchema, companyQuerySchema,
    ListIvrMenusResponse, GetIvrMenuResponse, CreateIvrMenuResponse, UpdateIvrMenuResponse,
} from './schemas/ivr.schema'
import { errors, deleted } from '../../schemas/responses'

export const ivrRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/ivr-menus', {
        onRequest: [...protectedRoute, requirePermission('ivr', 'view')],
        schema: {
            tags: ['IVR'],
            summary: 'Listar menus de URA por empresa',
            security: [{ bearerAuth: [] }],
            querystring: companyQuerySchema,
            response: {
                200: ListIvrMenusResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, IvrController.getIvrMenus as any)

    router.get('/ivr-menus/:id', {
        onRequest: [...protectedRoute, requirePermission('ivr', 'view')],
        schema: {
            tags: ['IVR'],
            summary: 'Buscar menu de URA',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: GetIvrMenuResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, IvrController.getIvrMenuById as any)

    router.post('/ivr-menus', {
        onRequest: [...protectedRoute, requirePermission('ivr', 'manage')],
        schema: {
            tags: ['IVR'],
            summary: 'Criar menu de URA',
            description: 'Cria o registro, a configuração e as opções de dígito (digit → destino) já em uma chamada. Envie audioId (criado via POST /audios) pra já sair com dialplan, ou omita e vincule depois via PUT.',
            security: [{ bearerAuth: [] }],
            body: createIvrMenuSchema.meta({
                examples: [
                    {
                        name: 'Menu simples (1 dígito)',
                        value: {
                            name: 'Menu Principal',
                            companyId: '<companyId>',
                            audioId: '<audioId>',
                            maxDigits: 1,
                            digitTimeout: 5,
                            invalidRetries: 3,
                            timeoutRetries: 3,
                            options: [
                                { digit: '1', destination: { type: 'extension', id: '<extensionId>' } },
                                { digit: '2', destination: { type: 'queue', id: '<queueId>' } },
                                { digit: '0', destination: { type: 'hangup' } },
                            ],
                            invalidDestination: { type: 'announcement', id: '<announcementId>' },
                            timeoutDestination: { type: 'announcement', id: '<announcementId>' },
                        },
                    },
                    {
                        name: 'Menu com longDestination (CPF)',
                        value: {
                            name: 'Consulta CPF',
                            companyId: '<companyId>',
                            audioId: '<audioId>',
                            maxDigits: 11,
                            digitTimeout: 10,
                            invalidRetries: 2,
                            timeoutRetries: 2,
                            options: [
                                { digit: '1', destination: { type: 'queue', id: '<queueId>' } },
                            ],
                            longDestination: { type: 'request', id: '<requestTemplateId>' },
                            invalidDestination: { type: 'announcement', id: '<announcementId>' },
                            timeoutDestination: { type: 'hangup' },
                        },
                    },
                    {
                        name: 'Coleta de dígitos (type=collect)',
                        value: {
                            name: 'Coleta CPF',
                            companyId: '<companyId>',
                            audioId: '<audioId>',
                            type: 'collect',
                            variableName: 'CPF_CLIENTE',
                            maxDigits: 11,
                            digitTimeout: 10,
                            invalidRetries: 2,
                            timeoutRetries: 2,
                            options: [],
                            longDestination: { type: 'variable-condition', id: '<variableConditionId>' },
                            invalidDestination: { type: 'hangup' },
                            timeoutDestination: { type: 'hangup' },
                        },
                    },
                ],
            }),
            response: {
                201: CreateIvrMenuResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, IvrController.createIvrMenu as any)

    router.put('/ivr-menus/:id', {
        onRequest: [...protectedRoute, requirePermission('ivr', 'manage')],
        schema: {
            tags: ['IVR'],
            summary: 'Atualizar menu de URA',
            description: 'Atualiza nome, audioId (null desvincula), timeouts, retries, destinos especiais (invalid/timeout/long) e/ou as opções de dígito. Quando enviado, `options` substitui a lista completa.',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateIvrMenuSchema,
            response: {
                200: UpdateIvrMenuResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, IvrController.updateIvrMenu as any)

    router.delete('/ivr-menus/:id', {
        onRequest: [...protectedRoute, requirePermission('ivr', 'manage')],
        schema: {
            tags: ['IVR'],
            summary: 'Remover menu de URA',
            description: 'Remove o registro, as opções e o dialplan - o Audio vinculado não é apagado.',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, IvrController.deleteIvrMenu as any)
}
