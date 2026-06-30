import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as DidsController from './dids.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { createDidSchema, updateDidSchema, idParamSchema, companyIdParamSchema } from './schemas/did.schema'
import { errors, ok, deleted } from '../../schemas/responses'
import { DidSchema } from './schemas/did.schema'

const optionalCompanyQuery = z.object({ companyId: z.cuid2().optional() })

export const didsRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/dids', {
        onRequest: protectedRoute,
        schema: {
            tags: ['DIDs'],
            summary: 'Listar DIDs',
            description: 'Admin retorna todos; outros filtram por empresa via ?companyId.',
            security: [{ bearerAuth: [] }],
            querystring: optionalCompanyQuery,
            response: {
                200: ok({ message: z.string(), dids: z.array(DidSchema) }),
                401: errors[401],
            },
        },
    }, DidsController.getDids as any)

    router.get('/dids/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['DIDs'],
            summary: 'Buscar DID',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: ok({ message: z.string(), did: DidSchema }),
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, DidsController.getDidById as any)

    router.get('/dids/company/:id_company', {
        onRequest: protectedRoute,
        schema: {
            tags: ['DIDs'],
            summary: 'Listar DIDs por empresa',
            security: [{ bearerAuth: [] }],
            params: companyIdParamSchema,
            response: {
                200: ok({ message: z.string(), dids: z.array(DidSchema) }),
                401: errors[401],
                403: errors[403],
            },
        },
    }, DidsController.getDidsByCompanyId as any)

    router.post('/dids', {
        onRequest: protectedRoute,
        schema: {
            tags: ['DIDs'],
            summary: 'Criar DID',
            description: 'O número deve ser único por empresa.',
            security: [{ bearerAuth: [] }],
            body: createDidSchema,
            response: {
                201: ok({ message: z.string(), didId: z.string() }),
                401: errors[401],
                403: errors[403],
                409: errors[409],
            },
        },
    }, DidsController.createDid as any)

    router.put('/dids/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['DIDs'],
            summary: 'Atualizar DID',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateDidSchema,
            response: {
                200: ok({ message: z.string() }),
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, DidsController.updateDid as any)

    router.delete('/dids/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['DIDs'],
            summary: 'Remover DID',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, DidsController.deleteDid as any)
}
