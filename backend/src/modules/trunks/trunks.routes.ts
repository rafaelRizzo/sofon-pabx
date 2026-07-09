import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as TrunksController from './trunks.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import {
    createTrunkSchema, updateTrunkSchema, trunkIdParamSchema, trunkQuerySchema,
    ListTrunksResponse, GetTrunkResponse, CreateTrunkResponse, UpdateTrunkResponse,
} from './schemas/trunk.schema'
import { errors, deleted } from '../../schemas/responses'

const optionalCompanyQuery = z.object({ companyId: z.cuid2().optional() })

export const trunksRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/trunks', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Trunks'],
            summary: 'Listar trunks',
            description: 'Filtra por empresa via ?companyId.',
            security: [{ bearerAuth: [] }],
            querystring: optionalCompanyQuery,
            response: {
                200: ListTrunksResponse,
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
                200: GetTrunkResponse,
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
                201: CreateTrunkResponse,
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
                200: UpdateTrunkResponse,
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
