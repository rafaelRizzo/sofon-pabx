import { type FastifyInstance } from 'fastify'
import * as ExtensionController from './extensions.controller'
import { verifyToken } from '../../middlewares/auth.middleware'

export const extensionRoutes = async (app: FastifyInstance) => {
    app.get('/extensions', { preHandler: verifyToken }, ExtensionController.getExtensions)
    app.get('/extensions/:id', { preHandler: verifyToken }, ExtensionController.getExtensionById)
    app.get('/companies/:companyId/extensions', { preHandler: verifyToken }, ExtensionController.getCompanyExtensions)
    app.post('/extensions', { preHandler: verifyToken }, ExtensionController.createExtension)
    app.put('/extensions/:id', { preHandler: verifyToken }, ExtensionController.updateExtension)
    app.delete('/extensions/:id', { preHandler: verifyToken }, ExtensionController.deleteExtension)
}
