import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as TrunksController from './trunks.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { createTrunkSchema, updateTrunkSchema, trunkIdParamSchema, trunkQuerySchema } from './schemas/trunk.schema'
import { errors, ok, deleted } from '../../schemas/responses'
import { TrunkSchema } from './schemas/trunk.schema'

export const trunksRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/trunks', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Trunks'],
            summary: 'Listar trunks',
            description: 'Query obrigatória: ?companyId.',
            security: [{ bearerAuth: [] }],
            querystring: trunkQuerySchema,
            response: {
                200: ok({ message: z.string(), trunks: z.array(TrunkSchema) }),
                401: errors[401],
                403: errors[403],
            },
        },
    }, TrunksController.getTrunks as any)

    router.get('/trunks/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Trunks'],
            summary: 'Buscar trunk',
            security: [{ bearerAuth: [] }],
            params: trunkIdParamSchema,
            response: {
                200: ok({ message: z.string(), trunk: TrunkSchema }),
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, TrunksController.getTrunkById as any)

    router.post('/trunks', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Trunks'],
            summary: 'Criar trunk',
            description: 'Discriminado por registrationMode: "outbound" | "inbound".',
            security: [{ bearerAuth: [] }],
            body: createTrunkSchema,
            response: {
                201: ok({ message: z.string(), trunk: TrunkSchema }),
                401: errors[401],
                403: errors[403],
                409: errors[409],
            },
        },
    }, TrunksController.createTrunk as any)

    router.put('/trunks/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Trunks'],
            summary: 'Atualizar trunk',
            security: [{ bearerAuth: [] }],
            params: trunkIdParamSchema,
            body: updateTrunkSchema,
            response: {
                200: ok({ message: z.string(), trunk: TrunkSchema }),
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, TrunksController.updateTrunk as any)

    router.delete('/trunks/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Trunks'],
            summary: 'Remover trunk',
            security: [{ bearerAuth: [] }],
            params: trunkIdParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, TrunksController.deleteTrunk as any)
}
