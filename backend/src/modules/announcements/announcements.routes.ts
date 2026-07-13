import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as AnnouncementsController from './announcements.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import {
    createAnnouncementSchema, updateAnnouncementSchema, idParamSchema, companyQuerySchema,
    ListAnnouncementsResponse, GetAnnouncementResponse, CreateAnnouncementResponse, UpdateAnnouncementResponse,
} from './schemas/announcement.schema'
import { errors, deleted } from '../../schemas/responses'

export const announcementsRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/announcements', {
        onRequest: [...protectedRoute, requirePermission('announcements', 'view')],
        schema: {
            tags: ['Announcements'],
            summary: 'Listar anúncios por empresa',
            security: [{ bearerAuth: [] }],
            querystring: companyQuerySchema,
            response: {
                200: ListAnnouncementsResponse,
                401: errors[401],
                403: errors[403],
            },
        },
    }, AnnouncementsController.getAnnouncements as any)

    router.get('/announcements/:id', {
        onRequest: [...protectedRoute, requirePermission('announcements', 'view')],
        schema: {
            tags: ['Announcements'],
            summary: 'Buscar anúncio',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: GetAnnouncementResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, AnnouncementsController.getAnnouncementById as any)

    router.post('/announcements', {
        onRequest: [...protectedRoute, requirePermission('announcements', 'manage')],
        schema: {
            tags: ['Announcements'],
            summary: 'Criar anúncio',
            description: 'Envie audioId (criado via POST /audios) pra já sair com dialplan, ou omita e vincule depois via PATCH.',
            security: [{ bearerAuth: [] }],
            body: createAnnouncementSchema,
            response: {
                201: CreateAnnouncementResponse,
                401: errors[401],
                403: errors[403],
                409: errors[409],
            },
        },
    }, AnnouncementsController.createAnnouncement as any)

    router.patch('/announcements/:id', {
        onRequest: [...protectedRoute, requirePermission('announcements', 'manage')],
        schema: {
            tags: ['Announcements'],
            summary: 'Atualizar anúncio',
            description: 'Renomeia e/ou (des)vincula o audioId (null desvincula, regenerando dialplan removido).',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateAnnouncementSchema,
            response: {
                200: UpdateAnnouncementResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, AnnouncementsController.updateAnnouncement as any)

    router.delete('/announcements/:id', {
        onRequest: [...protectedRoute, requirePermission('announcements', 'manage')],
        schema: {
            tags: ['Announcements'],
            summary: 'Remover anúncio',
            description: 'Remove o registro e o dialplan — o Audio vinculado não é apagado.',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, AnnouncementsController.deleteAnnouncement as any)
}
