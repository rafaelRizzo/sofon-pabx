import type { FastifyInstance } from 'fastify'
import * as Controller from './outbound-routes.controller'
import { protectedRoute } from '../../middleware/scope.middleware'

export const outboundRoutesRoutes = async (app: FastifyInstance) => {
    app.get('/outbound-routes',                                   { onRequest: protectedRoute }, Controller.getRoutes)
    app.get('/outbound-routes/:id',                               { onRequest: protectedRoute }, Controller.getRouteById)
    app.post('/outbound-routes',                                  { onRequest: protectedRoute }, Controller.createRoute)
    app.put('/outbound-routes/:id',                               { onRequest: protectedRoute }, Controller.updateRoute)
    app.delete('/outbound-routes/:id',                            { onRequest: protectedRoute }, Controller.deleteRoute)

    app.post('/outbound-routes/:id/patterns',                     { onRequest: protectedRoute }, Controller.addPattern)
    app.put('/outbound-routes/:id/patterns/:patternId',           { onRequest: protectedRoute }, Controller.updatePattern)
    app.delete('/outbound-routes/:id/patterns/:patternId',        { onRequest: protectedRoute }, Controller.deletePattern)

    app.put('/outbound-routes/:id/trunks',                        { onRequest: protectedRoute }, Controller.setTrunks)

    app.post('/outbound-routes/:id/extensions',                   { onRequest: protectedRoute }, Controller.addExtension)
    app.delete('/outbound-routes/:id/extensions/:extensionId',    { onRequest: protectedRoute }, Controller.removeExtension)
}
