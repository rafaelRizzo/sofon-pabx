import type { FastifyInstance } from 'fastify'
import * as ExtensionsController from './extensions.controller'
import { protectedRoute } from '../../middleware/scope.middleware'

export const extensionsRoutes = async (app: FastifyInstance) => {
    app.get('/extensions', { onRequest: protectedRoute }, ExtensionsController.getAllExtensions)
    app.get('/extensions/:id', { onRequest: protectedRoute }, ExtensionsController.getExtensionById)
    app.post('/extensions', { onRequest: protectedRoute }, ExtensionsController.createExtension)
    app.post('/extensions/batch', { onRequest: protectedRoute }, ExtensionsController.createExtensionBatch)
    app.put('/extensions/:id', { onRequest: protectedRoute }, ExtensionsController.updateExtension)
    app.delete('/extensions/:id', { onRequest: protectedRoute }, ExtensionsController.deleteExtension)
}
