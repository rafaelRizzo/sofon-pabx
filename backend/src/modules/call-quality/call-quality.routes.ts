import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as Controller from './call-quality.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import {
    callQualityQuerySchema,
    callQualitySummaryQuerySchema,
    CallQualitySummaryResponse,
    ListCallQualityResponse,
} from './schemas/call-quality.schema'
import { errors } from '../../schemas/responses'

// Recurso view-only, mesmo caso especial de 'cdr' - dado gerado pelo sistema (RTCP via AMI, ver
// handleHangup em ami-events.ts), nunca criado/editado manualmente
export const callQualityRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/call-quality', {
        onRequest: [...protectedRoute, requirePermission('call-quality', 'view')],
        schema: {
            tags: ['Call Quality'],
            summary: 'Listar qualidade de rede por chamada (tronco)',
            description:
                'Query obrigatória: ?companyId. Filtros opcionais: trunkId, startDate/endDate (YYYY-MM-DD, cobrem o dia inteiro). Médias reais (soma/contagem acumulada durante a chamada) de jitter/perda/RTT via RTCP nativo do Asterisk, só perna de tronco.',
            security: [{ bearerAuth: [] }],
            querystring: callQualityQuerySchema,
            response: {
                200: ListCallQualityResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, Controller.getCallQuality as any)

    router.get('/call-quality/summary', {
        onRequest: [...protectedRoute, requirePermission('call-quality', 'view')],
        schema: {
            tags: ['Call Quality'],
            summary: 'Média de qualidade de rede no período',
            description: 'Query obrigatória: ?companyId. Aceita os mesmos filtros da listagem. Retorna a média do período pra consulta rápida (ex: auditoria/ANATEL).',
            security: [{ bearerAuth: [] }],
            querystring: callQualitySummaryQuerySchema,
            response: {
                200: CallQualitySummaryResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, Controller.getCallQualitySummary as any)
}
