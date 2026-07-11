import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as RatingsController from './ratings.controller'
import { protectedRoute } from '../../../middleware/scope.middleware'
import { ratingQuerySchema, createRatingSchema, ListRatingsResponse, CreateRatingResponse } from './schemas/call-rating.schema'
import { errors } from '../../../schemas/responses'

export const callcenterRatingsRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/callcenter/ratings', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Callcenter Ratings'],
            summary: 'Listar notas de atendimento',
            description: 'Query obrigatória: ?companyId. Filtros opcionais: extensionId, number, startDate, endDate (YYYY-MM-DD, cobrem o dia inteiro), limit (max 200), order (asc|desc, default desc).',
            security: [{ bearerAuth: [] }],
            querystring: ratingQuerySchema,
            response: {
                200: ListRatingsResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, RatingsController.getRatings as any)

    router.post('/callcenter/ratings', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Callcenter Ratings'],
            summary: 'Registrar nota de atendimento',
            description: 'Registro interno — na Fase 2 será chamado pelo handler AGI da pesquisa IVR pós-chamada.',
            security: [{ bearerAuth: [] }],
            body: createRatingSchema,
            response: {
                201: CreateRatingResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, RatingsController.createRating as any)
}
