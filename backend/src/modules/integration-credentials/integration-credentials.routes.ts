import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as IntegrationCredentialsController from './integration-credentials.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import {
    createIntegrationCredentialSchema, updateIntegrationCredentialSchema, idParamSchema, companyQuerySchema, providerQuerySchema,
    ListIntegrationCredentialsResponse, GetIntegrationCredentialResponse, CreateIntegrationCredentialResponse, UpdateIntegrationCredentialResponse,
} from './schemas/integration-credential.schema'
import { errors, deleted } from '../../schemas/responses'

const listQuerySchema = companyQuerySchema.merge(providerQuerySchema)

export const integrationCredentialsRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/integration-credentials', {
        onRequest: [...protectedRoute, requirePermission('integrations', 'view')],
        schema: {
            tags: ['Integrations'],
            summary: 'Listar credenciais de integração por empresa (opcionalmente por provider)',
            security: [{ bearerAuth: [] }],
            querystring: listQuerySchema,
            response: {
                200: ListIntegrationCredentialsResponse,
                401: errors[401],
                403: errors[403],
            },
        },
    }, IntegrationCredentialsController.getIntegrationCredentials as any)

    router.get('/integration-credentials/:id', {
        onRequest: [...protectedRoute, requirePermission('integrations', 'view')],
        schema: {
            tags: ['Integrations'],
            summary: 'Buscar credencial de integração',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: GetIntegrationCredentialResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, IntegrationCredentialsController.getIntegrationCredentialById as any)

    router.post('/integration-credentials', {
        onRequest: [...protectedRoute, requirePermission('integrations', 'manage')],
        schema: {
            tags: ['Integrations'],
            summary: 'Criar credencial de integração',
            description:
                'Guarda base URL + token de acesso à API de um provedor (ex: IXCsoft), reutilizável ' +
                'por N nós sem precisar recadastrar. Token é criptografado em repouso (AES-256-GCM, ' +
                'chave por empresa) e nunca retorna em GET — pra trocar, reenviar o campo inteiro.',
            security: [{ bearerAuth: [] }],
            body: createIntegrationCredentialSchema,
            response: {
                201: CreateIntegrationCredentialResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, IntegrationCredentialsController.createIntegrationCredential as any)

    router.put('/integration-credentials/:id', {
        onRequest: [...protectedRoute, requirePermission('integrations', 'manage')],
        schema: {
            tags: ['Integrations'],
            summary: 'Atualizar credencial de integração',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateIntegrationCredentialSchema,
            response: {
                200: UpdateIntegrationCredentialResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, IntegrationCredentialsController.updateIntegrationCredential as any)

    router.delete('/integration-credentials/:id', {
        onRequest: [...protectedRoute, requirePermission('integrations', 'manage')],
        schema: {
            tags: ['Integrations'],
            summary: 'Remover credencial de integração',
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
    }, IntegrationCredentialsController.deleteIntegrationCredential as any)
}
