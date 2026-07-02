import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as Controller from './cdr.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { cdrQuerySchema, ListCdrResponse } from './schemas/cdr.schema'
import { errors } from '../../schemas/responses'

export const cdrRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/cdr', {
        onRequest: protectedRoute,
        schema: {
            tags: ['CDR'],
            summary: 'Listar registros de chamadas (CDR)',
            description: 'Query obrigatória: ?companyId. Filtros opcionais: startDate, endDate, src, dst, disposition, limit, offset.',
            security: [{ bearerAuth: [] }],
            querystring: cdrQuerySchema,
            response: {
                200: ListCdrResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, Controller.getCdr as any)
}
