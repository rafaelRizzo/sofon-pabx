import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as AnnouncementsController from './announcements.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import {
    createAnnouncementSchema, updateAnnouncementSchema, idParamSchema, companyQuerySchema,
    ListAnnouncementsResponse, GetAnnouncementResponse, CreateAnnouncementResponse, UpdateAnnouncementResponse,
    UploadAnnouncementAudioResponse,
} from './schemas/announcement.schema'
import { errors, deleted } from '../../schemas/responses'

export const announcementsRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/announcements', {
        onRequest: protectedRoute,
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
        onRequest: protectedRoute,
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
        onRequest: protectedRoute,
        schema: {
            tags: ['Announcements'],
            summary: 'Criar anúncio',
            description: 'Cria só o registro — envie o áudio depois via POST /announcements/:id/audio.',
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
        onRequest: protectedRoute,
        schema: {
            tags: ['Announcements'],
            summary: 'Renomear anúncio',
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
        onRequest: protectedRoute,
        schema: {
            tags: ['Announcements'],
            summary: 'Remover anúncio',
            description: 'Remove o registro, o dialplan e o arquivo de áudio no disco.',
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

    router.post('/announcements/:id/audio', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Announcements'],
            summary: 'Enviar áudio do anúncio',
            description:
                'multipart/form-data com um campo de arquivo. Converte automaticamente pra WAV PCM 16-bit ' +
                'mono 8kHz (slin) — qualidade sem perdas e compatível com os codecs das trunks (ulaw/alaw), ' +
                'sem resample na chamada. Sobrescreve o áudio anterior, se houver.',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            consumes: ['multipart/form-data'],
            response: {
                200: UploadAnnouncementAudioResponse,
                400: errors[400],
                401: errors[401],
                403: errors[403],
                404: errors[404],
                422: errors[422],
            },
        },
    }, AnnouncementsController.uploadAnnouncementAudio as any)
}
