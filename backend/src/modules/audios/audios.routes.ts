import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as AudiosController from './audios.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import {
    updateAudioSchema, createAudioTtsSchema, idParamSchema, companyQuerySchema, voicePreviewQuerySchema, listVoicesQuerySchema,
    ListAudiosResponse, GetAudioResponse, CreateAudioResponse, UpdateAudioResponse,
    CreateAudioTtsResponse, ListVoicesResponse, GetSubscriptionResponse,
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

    router.get('/audios/:id/file', {
        onRequest: [...protectedRoute, requirePermission('audios', 'view')],
        schema: {
            tags: ['Audios'],
            summary: 'Baixar/ouvir o arquivo de áudio',
            description: 'Faz streaming do .wav convertido. 404 se o áudio ou o arquivo em disco não existir.',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, AudiosController.getAudioFile as any)

    router.post('/audios', {
        ...uploadRateLimit,
        onRequest: [...protectedRoute, requirePermission('audios', 'manage')],
        schema: {
            tags: ['Audios'],
            summary: 'Enviar novo áudio',
            description:
                'multipart/form-data com os campos `name` e `companyId` (texto) seguidos do arquivo - ' +
                'nessa ordem, o cliente precisa enviar os campos de texto antes do arquivo no form. ' +
                'Converte automaticamente pra WAV PCM 16-bit mono 8kHz (slin) - qualidade sem perdas e ' +
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
            description: 'Cacheado por 1h (Redis). Passe `refresh=true` pra ignorar o cache e buscar direto da ElevenLabs - útil logo após adicionar/remover voz na conta.',
            security: [{ bearerAuth: [] }],
            querystring: listVoicesQuerySchema,
            response: {
                200: ListVoicesResponse,
                400: errors[400],
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, AudiosController.getVoices as any)

    router.get('/audios/tts/subscription', {
        onRequest: [...protectedRoute, requirePermission('audios', 'view')],
        schema: {
            tags: ['Audios'],
            summary: 'Saldo/limites da conta ElevenLabs configurada na empresa',
            description: 'Sempre busca direto na ElevenLabs (sem cache) - reflete o consumo real de caracteres no momento da chamada.',
            security: [{ bearerAuth: [] }],
            querystring: companyQuerySchema,
            response: {
                200: GetSubscriptionResponse,
                400: errors[400],
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, AudiosController.getSubscription as any)

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

    router.get('/audios/tts/preview', {
        ...uploadRateLimit,
        onRequest: [...protectedRoute, requirePermission('audios', 'view')],
        schema: {
            tags: ['Audios'],
            summary: 'Prévia de voz da ElevenLabs em pt/en',
            description:
                'Gera (ou reaproveita do cache) uma frase curta de demonstração na voz e idioma ' +
                'escolhidos - diferente de `previewUrl` de `/audios/tts/voices`, que vem fixo da ' +
                'ElevenLabs (geralmente em inglês). Retorna o áudio bruto (audio/mpeg), cacheado por ' +
                '7 dias por empresa+voz+idioma pra não gastar cota da ElevenLabs a cada clique.',
            security: [{ bearerAuth: [] }],
            querystring: voicePreviewQuerySchema,
            response: {
                400: errors[400],
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, AudiosController.getVoicePreview as any)

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
