import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as Controller from './audit-logs.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import { auditLogQuerySchema, ListAuditLogsResponse } from './schemas/audit-log.schema'
import { errors } from '../../schemas/responses'

export const auditLogsRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get(
        '/audit-logs',
        {
            onRequest: [...protectedRoute, requirePermission('audit-logs', 'view')],
            schema: {
                tags: ['Audit Logs'],
                summary: 'Listar log de auditoria (quem mudou o quê e quando)',
                description:
                    'Filtros opcionais: companyId, actorId, model, recordId, action (CREATE|UPDATE|DELETE), startDate/endDate (YYYY-MM-DD), limit (max 200), page (default 1), order (asc|desc, default desc). Sem admin/reseller, restrito às empresas do escopo do usuário.',
                security: [{ bearerAuth: [] }],
                querystring: auditLogQuerySchema,
                response: {
                    200: ListAuditLogsResponse,
                    401: errors[401],
                    403: errors[403],
                },
            },
        },
        Controller.getAuditLogs as any,
    )
}
