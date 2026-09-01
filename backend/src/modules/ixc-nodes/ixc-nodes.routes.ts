import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as IxcNodesController from './ixc-nodes.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import {
    createIxcNodeSchema, updateIxcNodeSchema, testIxcNodeSchema, idParamSchema, optionalCompanyQuery,
    ListIxcNodesResponse, GetIxcNodeResponse, CreateIxcNodeResponse, UpdateIxcNodeResponse, TestIxcNodeResponse,
} from './schemas/ixc-node.schema'
import { errors, deleted } from '../../schemas/responses'

export const ixcNodesRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/ixc-nodes', {
        onRequest: [...protectedRoute, requirePermission('ixc', 'view')],
        schema: {
            tags: ['IXC'],
            summary: 'Listar nós IXCsoft por empresa',
            security: [{ bearerAuth: [] }],
            querystring: optionalCompanyQuery,
            response: {
                200: ListIxcNodesResponse,
                401: errors[401],
                403: errors[403],
            },
        },
    }, IxcNodesController.getIxcNodes as any)

    router.get('/ixc-nodes/:id', {
        onRequest: [...protectedRoute, requirePermission('ixc', 'view')],
        schema: {
            tags: ['IXC'],
            summary: 'Buscar nó IXCsoft',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: GetIxcNodeResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, IxcNodesController.getIxcNodeById as any)

    router.post('/ixc-nodes', {
        onRequest: [...protectedRoute, requirePermission('ixc', 'manage')],
        schema: {
            tags: ['IXC'],
            summary: 'Criar nó IXCsoft',
            description:
                'Nó pré-configurado de integração com o IXCsoft, executado em tempo de chamada via AGI ' +
                'quando referenciado como destino de rota (type: "ixc"). Aponta pra uma IxcCredential ' +
                '(base URL + token, cadastrada uma vez em /ixc-credentials) e uma action fixa do catálogo ' +
                '(listar_cliente/listar_boleto). params aceita placeholders {{VAR}} resolvidos via AGI GET ' +
                'VARIABLE. variableMappings extrai campos do JSON de resposta pra variáveis de canal.',
            security: [{ bearerAuth: [] }],
            body: createIxcNodeSchema,
            response: {
                201: CreateIxcNodeResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, IxcNodesController.createIxcNode as any)

    router.post('/ixc-nodes/test', {
        onRequest: [...protectedRoute, requirePermission('ixc', 'manage')],
        schema: {
            tags: ['IXC'],
            summary: 'Testar requisição IXCsoft (sem salvar)',
            description:
                'Executa credentialId+action+params direto contra o IXCsoft e devolve a resposta crua, ' +
                'sem persistir nada. Usado pelo editor do nó pra o usuário ver o shape da resposta antes ' +
                'de configurar variableMappings. Placeholders {{VAR}} em params não são resolvidos aqui ' +
                '(sem canal/AGI) - devem ser enviados como valor literal de teste.',
            security: [{ bearerAuth: [] }],
            body: testIxcNodeSchema,
            response: {
                200: TestIxcNodeResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, IxcNodesController.testIxcNode as any)

    router.put('/ixc-nodes/:id', {
        onRequest: [...protectedRoute, requirePermission('ixc', 'manage')],
        schema: {
            tags: ['IXC'],
            summary: 'Atualizar nó IXCsoft',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateIxcNodeSchema,
            response: {
                200: UpdateIxcNodeResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, IxcNodesController.updateIxcNode as any)

    router.delete('/ixc-nodes/:id', {
        onRequest: [...protectedRoute, requirePermission('ixc', 'manage')],
        schema: {
            tags: ['IXC'],
            summary: 'Remover nó IXCsoft',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, IxcNodesController.deleteIxcNode as any)
}
