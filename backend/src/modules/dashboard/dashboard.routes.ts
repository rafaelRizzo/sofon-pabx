import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as Controller from './dashboard.controller'
import { protectedRoute, requireAdmin } from '../../middleware/scope.middleware'
import { dashboardOverviewQuerySchema, DashboardInfraResponse, DashboardOverviewResponse } from './schemas/dashboard.schema'
import { errors } from '../../schemas/responses'

export const dashboardRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/dashboard/overview', {
        // Sem requirePermission granular - é agregado do que o usuário já vê via scope (extensions/
        // CDR), mesmo padrão de /system/sip-config
        onRequest: protectedRoute,
        schema: {
            tags: ['Dashboard'],
            summary: 'Visão geral (ramais online, chamadas do período)',
            description: 'Escopado pela empresa do usuário (ou todas, se admin sem filtro). Ramais online/offline via presença ao vivo; chamadas hoje/mês/ano via CDR. Filtro opcional ?companyId estreita dentro do scope.',
            security: [{ bearerAuth: [] }],
            querystring: dashboardOverviewQuerySchema,
            response: {
                200: DashboardOverviewResponse,
                401: errors[401],
            },
        },
    }, Controller.getOverview as any)

    router.get('/dashboard/infra', {
        // Infra compartilhada entre TODAS as empresas (uma VPS só) - não é dado de uma empresa,
        // não faz sentido escopar por companyId nem gatear por permissão granular
        onRequest: [...protectedRoute, requireAdmin],
        schema: {
            tags: ['Dashboard'],
            summary: 'Saúde da infraestrutura (CPU/memória/disco/gravações)',
            description: 'Admin-only. CPU (load average nativo), memória, disco da partição do Asterisk (bind mount real do host) e tamanho total das gravações (cacheado ~5min).',
            security: [{ bearerAuth: [] }],
            response: {
                200: DashboardInfraResponse,
                401: errors[401],
                403: errors[403],
            },
        },
    }, Controller.getInfra as any)
}
