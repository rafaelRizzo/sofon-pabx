import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as AudiosController from './audios.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import {
    updateAudioSchema, createAudioTtsSchema, idParamSchema, companyQuerySchema,
    ListAudiosResponse, GetAudioResponse, CreateAudioResponse, UpdateAudioResponse,
    CreateAudioTtsResponse, ListVoicesResponse,
} from './schemas/audio.schema'
import { errors, deleted } from '../../schemas/responses'
import { validateEnv } from '../../config/env'

const env = validateEnv()
const uploadRateLimit = {
    config: {
        rateLimit: {
            max: env.AUDIO_UPLOAD_RATE_LIMIT_MAX,
            timeWindow: env.AUDIO_UPLOAD_RATE_LIMIT_WINDOW,
        },
    },
}

export const audiosRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/audios', {
        onRequest: [...protectedRoute, requirePermission('audios', 'view')],
        schema: {
            tags: ['Audios'],
            summary: 'Listar áudios por empresa',
            security: [{ bearerAuth: [] }],
            querystring: companyQuerySchema,
            response: {
                200: ListAudiosResponse,
                401: errors[401],
                403: errors[403],
            },
        },
    }, AudiosController.getAudios as any)

    router.get('/audios/:id', {
        onRequest: [...protectedRoute, requirePermission('audios', 'view')],
        schema: {
            tags: ['Audios'],
            summary: 'Buscar áudio',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: GetAudioResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, AudiosController.getAudioById as any)

    router.post('/audios', {
        ...uploadRateLimit,
        onRequest: [...protectedRoute, requirePermission('audios', 'manage')],
        schema: {
            tags: ['Audios'],
            summary: 'Enviar novo áudio',
            description:
                'multipart/form-data com os campos `name` e `companyId` (texto) seguidos do arquivo — ' +
                'nessa ordem, o cliente precisa enviar os campos de texto antes do arquivo no form. ' +
                'Converte automaticamente pra WAV PCM 16-bit mono 8kHz (slin) — qualidade sem perdas e ' +
                'compatível com os codecs das trunks (ulaw/alaw), sem resample na chamada. Retorna o ' +
                '`audioId` pra ser referenciado em Announcements, IVR Menus etc.',
            security: [{ bearerAuth: [] }],
            consumes: ['multipart/form-data'],
            response: {
                201: CreateAudioResponse,
                400: errors[400],
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
                422: errors[422],
            },
        },
    }, AudiosController.createAudio as any)

    router.get('/audios/tts/voices', {
        onRequest: [...protectedRoute, requirePermission('audios', 'view')],
        schema: {
            tags: ['Audios'],
            summary: 'Listar vozes disponíveis na ElevenLabs (da conta configurada na empresa)',
            security: [{ bearerAuth: [] }],
            querystring: companyQuerySchema,
            response: {
                200: ListVoicesResponse,
                400: errors[400],
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, AudiosController.getVoices as any)

    router.post('/audios/tts', {
        ...uploadRateLimit,
        onRequest: [...protectedRoute, requirePermission('audios', 'manage')],
        schema: {
            tags: ['Audios'],
            summary: 'Gerar áudio por texto (TTS via ElevenLabs)',
            description:
                'Converte o texto em áudio usando a voz escolhida (ElevenLabs) e salva como um Audio ' +
                'normal, já convertido pra WAV PCM 16-bit mono 8kHz. Retorna o `audioId` pra ser ' +
                'referenciado em Announcements, IVR Menus etc.',
            security: [{ bearerAuth: [] }],
            body: createAudioTtsSchema,
            response: {
                201: CreateAudioTtsResponse,
                400: errors[400],
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, AudiosController.createAudioTts as any)

    router.patch('/audios/:id', {
        onRequest: [...protectedRoute, requirePermission('audios', 'manage')],
        schema: {
            tags: ['Audios'],
            summary: 'Renomear áudio',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateAudioSchema,
            response: {
                200: UpdateAudioResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, AudiosController.updateAudio as any)

    router.delete('/audios/:id', {
        onRequest: [...protectedRoute, requirePermission('audios', 'manage')],
        schema: {
            tags: ['Audios'],
            summary: 'Remover áudio',
            description: 'Remove o registro e o arquivo em disco. Qualquer Announcement/IVR Menu que ' +
                'referencie esse áudio é desvinculado automaticamente (volta a hasAudio=false).',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, AudiosController.deleteAudio as any)
}
