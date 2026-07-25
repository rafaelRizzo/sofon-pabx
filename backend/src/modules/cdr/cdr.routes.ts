import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as Controller from './cdr.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import {
    cdrMetricsQuerySchema,
    cdrQuerySchema,
    CdrMetricsResponse,
    ListCdrResponse
} from './schemas/cdr.schema'
import { errors } from '../../schemas/responses'

export const cdrRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get(
        '/cdr',
        {
            onRequest: [...protectedRoute, requirePermission('cdr', 'view')],
            schema: {
                tags: ['CDR'],
                summary: 'Listar registros de chamadas (CDR)',
                description:
                    'Query obrigatória: ?companyId. Filtros opcionais: startDate, endDate (YYYY-MM-DD, cobrem o dia inteiro), src, dst, callStatus, direction, originExtension, dialedNumber, trunkId, queueName, linkedid, uniqueid, limit (max 200), cursor e order (asc|desc, default desc).',
                security: [{ bearerAuth: [] }],
                querystring: cdrQuerySchema,
                response: {
                    200: ListCdrResponse,
                    401: errors[401],
                    403: errors[403],
                    404: errors[404]
                }
            }
        },
        Controller.getCdr as any
    )

    router.get(
        '/cdr/metrics',
        {
            onRequest: [...protectedRoute, requirePermission('cdr', 'view')],
            schema: {
                tags: ['CDR'],
                summary: 'Métricas agregadas de chamadas',
                description:
                    'Query obrigatória: ?companyId. Aceita os mesmos filtros da listagem, exceto paginação. Retorna volume, atendidas, taxa de atendimento, duração, bilhetagem e agrupamentos por status e direção.',
                security: [{ bearerAuth: [] }],
                querystring: cdrMetricsQuerySchema,
                response: {
                    200: CdrMetricsResponse,
                    401: errors[401],
                    403: errors[403],
                    404: errors[404]
                }
            }
        },
        Controller.getCdrMetrics as any
    )
}
