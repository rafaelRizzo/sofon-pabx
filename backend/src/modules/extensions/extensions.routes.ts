import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as ExtensionsController from './extensions.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import {
    createExtensionSchema, createExtensionBatchSchema, updateExtensionSchema, extensionIdParamSchema,
    BatchResultSchema, ListExtensionsResponse, GetExtensionResponse,
    CreateExtensionResponse, UpdateExtensionResponse, ResetPasswordResponse, ExportExtensionsResponse,
    MyWebrtcResponse,
} from './schemas/extension.schema'
import { errors, deleted } from '../../schemas/responses'

const optionalCompanyQuery = z.object({ companyId: z.cuid2().optional() })

export const extensionsRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/extensions', {
        onRequest: [...protectedRoute, requirePermission('extensions', 'view')],
        schema: {
            tags: ['Extensions'],
            summary: 'Listar ramais',
            description: 'Filtra por empresa via ?companyId.',
            security: [{ bearerAuth: [] }],
            querystring: optionalCompanyQuery,
            response: {
                200: ListExtensionsResponse,
                401: errors[401],
            },
        },
    }, ExtensionsController.getAllExtensions as any)

    router.get('/extensions/export', {
        onRequest: [...protectedRoute, requirePermission('extensions', 'view')],
        schema: {
            tags: ['Extensions'],
            summary: 'Exportar ramais com usuário e senha',
            description: 'Filtra por empresa via ?companyId. Expõe a senha em texto puro — uso restrito.',
            security: [{ bearerAuth: [] }],
            querystring: optionalCompanyQuery,
            response: {
                200: ExportExtensionsResponse,
                401: errors[401],
            },
        },
    }, ExtensionsController.exportExtensions as any)

    router.get('/extensions/me/webrtc', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Extensions'],
            summary: 'Credenciais WebRTC do usuário logado',
            description: 'Busca as credenciais SIP do ramal vinculado ao usuário logado (User.extensionId), pra registrar o softphone no browser. Sem gate de permissão de extensions — é identidade, não CRUD de terceiro.',
            security: [{ bearerAuth: [] }],
            response: {
                200: MyWebrtcResponse,
                400: errors[400],
                401: errors[401],
                404: errors[404],
            },
        },
    }, ExtensionsController.getMyWebrtcCredentials as any)

    router.get('/extensions/:id', {
        onRequest: [...protectedRoute, requirePermission('extensions', 'view')],
        schema: {
            tags: ['Extensions'],
            summary: 'Buscar ramal',
            security: [{ bearerAuth: [] }],
            params: extensionIdParamSchema,
            response: {
                200: GetExtensionResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, ExtensionsController.getExtensionById as any)

    router.post('/extensions', {
        onRequest: [...protectedRoute, requirePermission('extensions', 'manage')],
        schema: {
            tags: ['Extensions'],
            summary: 'Criar ramal',
            description: 'Discriminado por type: "sip" | "pjsip".',
            security: [{ bearerAuth: [] }],
            body: createExtensionSchema,
            response: {
                201: CreateExtensionResponse,
                401: errors[401],
                403: errors[403],
                409: errors[409],
            },
        },
    }, ExtensionsController.createExtension as any)

    router.post('/extensions/batch', {
        onRequest: [...protectedRoute, requirePermission('extensions', 'manage')],
        schema: {
            tags: ['Extensions'],
            summary: 'Criar ramais em lote',
            description: 'Máx 50. Retorna 201 (tudo ok), 207 (parcial) ou 422 (tudo falhou).',
            security: [{ bearerAuth: [] }],
            body: createExtensionBatchSchema,
            response: {
                201: BatchResultSchema,
                207: BatchResultSchema,
                401: errors[401],
                422: errors[422],
            },
        },
    }, ExtensionsController.createExtensionBatch as any)

    router.put('/extensions/:id', {
        onRequest: [...protectedRoute, requirePermission('extensions', 'manage')],
        schema: {
            tags: ['Extensions'],
            summary: 'Atualizar ramal',
            security: [{ bearerAuth: [] }],
            params: extensionIdParamSchema,
            body: updateExtensionSchema,
            response: {
                200: UpdateExtensionResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, ExtensionsController.updateExtension as any)

    router.patch('/extensions/:id/password', {
        onRequest: [...protectedRoute, requirePermission('extensions', 'manage')],
        schema: {
            tags: ['Extensions'],
            summary: 'Resetar senha do ramal',
            description: 'Gera nova senha aleatória e a retorna.',
            security: [{ bearerAuth: [] }],
            params: extensionIdParamSchema,
            response: {
                200: ResetPasswordResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, ExtensionsController.resetExtensionPassword as any)

    router.delete('/extensions/:id', {
        onRequest: [...protectedRoute, requirePermission('extensions', 'manage')],
        schema: {
            tags: ['Extensions'],
            summary: 'Remover ramal',
            security: [{ bearerAuth: [] }],
            params: extensionIdParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, ExtensionsController.deleteExtension as any)
}
