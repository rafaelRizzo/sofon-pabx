import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as CompaniesController from './companies.controller'
import { protectedRoute, requireAdmin } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import {
    createCompanySchema, updateCompanySchema, idParamSchema, userIdParamSchema,
    ListCompaniesResponse, GetCompanyResponse, CreateCompanyResponse, UpdateCompanyResponse,
    ResyncDialplanResponse,
} from './schemas/company.schema'
import { errors, deleted } from '../../schemas/responses'

export const companiesRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/companies', {
        onRequest: [...protectedRoute, requirePermission('companies', 'view')],
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
        onRequest: [...protectedRoute, requirePermission('companies', 'view')],
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
        onRequest: [...protectedRoute, requirePermission('companies', 'view')],
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
        onRequest: [...protectedRoute, requirePermission('companies', 'manage')],
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
        onRequest: [...protectedRoute, requirePermission('companies', 'manage')],
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

    router.post('/companies/:id/resync-dialplan', {
        onRequest: [...protectedRoute, requireAdmin],
        schema: {
            tags: ['Companies'],
            summary: 'Resincronizar dialplan estático',
            description:
                'Regenera todos os arquivos estáticos de dialplan (/etc/asterisk/dialplan-extra/**) da ' +
                'empresa a partir do banco (time conditions, announcements, ivrs, queues-app, request ' +
                'templates, holidays, variables, variable conditions, callcenter surveys, flows), o padrão ' +
                'genérico de "ramais" (Realtime, compartilhado entre empresas), as inbound routes e os ' +
                'patterns de outbound routes — garante que o dialplan em produção reflita o template ' +
                'atual do código mesmo em instalações antigas, e remove linhas Realtime órfãs de ' +
                'inbound routes deletadas fora do fluxo normal. Útil depois de reinstalar o Asterisk ' +
                'mantendo o banco intacto, ou depois de uma mudança no template de dialplan (ex: novos ' +
                'campos de CDR/gravação), sem precisar recriar cada ramal/rota manualmente. Também recria ' +
                '/etc/asterisk/sofon-managed.conf (esqueleto global: ramais/transfer/from-trunk/' +
                'from-trunk-routed) se ele tiver sido perdido e remove o atalho legado de transferência ' +
                'cega #1 de /etc/asterisk/features.conf, recarregando res_features via AMI — não precisa ' +
                'mais reaplicar o instalador ' +
                'inteiro pra isso. Serializado por empresa (chamadas concorrentes pra mesma empresa ' +
                'enfileiram). Ao final aguarda o "dialplan reload" via AMI e retorna erro real (502) se o ' +
                'reload não puder ser confirmado — arquivos/banco já ficam corretos mesmo nesse caso, mas o ' +
                'Asterisk só aplica após um reload bem-sucedido. Requer role admin.',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: ResyncDialplanResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, CompaniesController.resyncDialplan as any)

    router.delete('/companies/:id', {
        onRequest: [...protectedRoute, requireAdmin],
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
