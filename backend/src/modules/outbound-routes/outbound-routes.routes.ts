import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as Controller from './outbound-routes.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import {
    createOutboundRouteSchema,
    updateOutboundRouteSchema,
    addPatternSchema,
    updatePatternSchema,
    setTrunksSchema,
    addExtensionSchema,
    routeIdParamSchema,
    patternIdParamSchema,
    extensionParamSchema,
    companyQuerySchema,
} from './outbound-routes.schema'
import { errors, ok, deleted } from '../../schemas/responses'
import { OutboundRouteSchema, PatternSchema } from './outbound-routes.schema'

export const outboundRoutesRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/outbound-routes', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Outbound Routes'],
            summary: 'Listar rotas de saída',
            description: 'Query obrigatória: ?companyId.',
            security: [{ bearerAuth: [] }],
            querystring: companyQuerySchema,
            response: {
                200: z.object({ success: z.literal(true), routes: z.array(OutboundRouteSchema) }),
                401: errors[401],
                403: errors[403],
            },
        },
    }, Controller.getRoutes as any)

    router.get('/outbound-routes/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Outbound Routes'],
            summary: 'Buscar rota',
            security: [{ bearerAuth: [] }],
            params: routeIdParamSchema,
            response: {
                200: z.object({ success: z.literal(true), route: OutboundRouteSchema }),
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, Controller.getRouteById as any)

    router.post('/outbound-routes', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Outbound Routes'],
            summary: 'Criar rota de saída',
            description: 'Aceita patterns e trunks no body.',
            security: [{ bearerAuth: [] }],
            body: createOutboundRouteSchema,
            response: {
                201: z.object({ success: z.literal(true), route: OutboundRouteSchema }),
                401: errors[401],
                403: errors[403],
                409: errors[409],
            },
        },
    }, Controller.createRoute as any)

    router.put('/outbound-routes/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Outbound Routes'],
            summary: 'Atualizar rota',
            security: [{ bearerAuth: [] }],
            params: routeIdParamSchema,
            body: updateOutboundRouteSchema,
            response: {
                200: z.object({ success: z.literal(true), route: OutboundRouteSchema }),
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, Controller.updateRoute as any)

    router.delete('/outbound-routes/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Outbound Routes'],
            summary: 'Remover rota',
            description: 'Remove em cascade os patterns associados.',
            security: [{ bearerAuth: [] }],
            params: routeIdParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, Controller.deleteRoute as any)

    router.post('/outbound-routes/:id/patterns', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Outbound Routes'],
            summary: 'Adicionar dial pattern',
            security: [{ bearerAuth: [] }],
            params: routeIdParamSchema,
            body: addPatternSchema,
            response: {
                201: z.object({ success: z.literal(true), pattern: PatternSchema }),
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, Controller.addPattern as any)

    router.put('/outbound-routes/:id/patterns/:patternId', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Outbound Routes'],
            summary: 'Atualizar dial pattern',
            security: [{ bearerAuth: [] }],
            params: patternIdParamSchema,
            body: updatePatternSchema,
            response: {
                200: z.object({ success: z.literal(true), pattern: PatternSchema }),
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, Controller.updatePattern as any)

    router.delete('/outbound-routes/:id/patterns/:patternId', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Outbound Routes'],
            summary: 'Remover dial pattern',
            security: [{ bearerAuth: [] }],
            params: patternIdParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, Controller.deletePattern as any)

    router.put('/outbound-routes/:id/trunks', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Outbound Routes'],
            summary: 'Definir trunks da rota',
            description: 'Substitui a lista completa de trunks.',
            security: [{ bearerAuth: [] }],
            params: routeIdParamSchema,
            body: setTrunksSchema,
            response: {
                200: z.object({ success: z.literal(true), route: OutboundRouteSchema }),
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, Controller.setTrunks as any)

    router.post('/outbound-routes/:id/extensions', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Outbound Routes'],
            summary: 'Restringir rota a ramal',
            security: [{ bearerAuth: [] }],
            params: routeIdParamSchema,
            body: addExtensionSchema,
            response: {
                201: z.object({ success: z.literal(true), record: z.object({ id: z.string(), outboundRouteId: z.string(), extensionId: z.string() }) }),
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, Controller.addExtension as any)

    router.delete('/outbound-routes/:id/extensions/:extensionId', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Outbound Routes'],
            summary: 'Remover restrição de ramal',
            security: [{ bearerAuth: [] }],
            params: extensionParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, Controller.removeExtension as any)
}
