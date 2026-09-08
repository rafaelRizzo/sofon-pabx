import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as RatingsController from './ratings.controller'
import { protectedRoute } from '../../../middleware/scope.middleware'
import { requirePermission } from '../../../middleware/permission.middleware'
import {
    ratingQuerySchema,
    ratingExportQuerySchema,
    ratingIdParamSchema,
    ratingRecordingQuerySchema,
    createRatingSchema,
    ListRatingsResponse,
    CreateRatingResponse,
} from './schemas/call-rating.schema'
import { errors } from '../../../schemas/responses'

export const callcenterRatingsRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/callcenter/ratings', {
        onRequest: [...protectedRoute, requirePermission('callcenter', 'view')],
        schema: {
            tags: ['Callcenter Ratings'],
            summary: 'Listar notas de atendimento',
            description: 'Query obrigatória: ?companyId. Filtros opcionais: extensionId, number, score (bate em scoreAtendimento OU scoreServico), startDate, endDate (YYYY-MM-DD, cobrem o dia inteiro), limit (max 200), page (default 1), order (asc|desc, default desc). 1 registro por chamada (as 2 perguntas da pesquisa preenchem colunas diferentes da mesma linha).',
            security: [{ bearerAuth: [] }],
            querystring: ratingQuerySchema,
            response: {
                200: ListRatingsResponse,
                400: errors[400],
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, RatingsController.getRatings as any)

    router.get('/callcenter/ratings/export', {
        onRequest: [...protectedRoute, requirePermission('callcenter', 'view')],
        schema: {
            tags: ['Callcenter Ratings'],
            summary: 'Exportar notas de atendimento (CSV)',
            description: 'Query obrigatória: ?companyId. Aceita os mesmos filtros da listagem, exceto paginação - faz streaming de todos os registros que batem com o filtro como CSV (sem limite de linhas).',
            security: [{ bearerAuth: [] }],
            querystring: ratingExportQuerySchema,
            response: {
                400: errors[400],
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, RatingsController.exportRatings as any)

    router.get('/callcenter/ratings/:id/recording', {
        onRequest: [...protectedRoute, requirePermission('callcenter', 'view')],
        schema: {
            tags: ['Callcenter Ratings'],
            summary: 'Baixar gravação da chamada vinculada à nota',
            description: 'Query obrigatória: ?companyId. Resolve a chamada da mesma ligação via cdr.uniqueid (sem FK, ver schema.prisma) e faz streaming do .wav gravado pelo Asterisk (MixMonitor). 404 se a nota não tiver uniqueid, ou se a chamada não tiver gravação.',
            security: [{ bearerAuth: [] }],
            params: ratingIdParamSchema,
            querystring: ratingRecordingQuerySchema,
            response: {
                400: errors[400],
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, RatingsController.getRatingRecording as any)

    router.post('/callcenter/ratings', {
        onRequest: [...protectedRoute, requirePermission('callcenter', 'manage')],
        schema: {
            tags: ['Callcenter Ratings'],
            summary: 'Registrar nota de atendimento',
            description: 'Registro interno - na Fase 2 será chamado pelo handler AGI da pesquisa IVR pós-chamada.',
            security: [{ bearerAuth: [] }],
            body: createRatingSchema,
            response: {
                201: CreateRatingResponse,
                400: errors[400],
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, RatingsController.createRating as any)
}
