import { z } from 'zod'
import { timestamp, cuidParam, ok } from '../../../schemas/responses'

export const idParamSchema = z.object({ id: cuidParam })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })
export const listVoicesQuerySchema = companyQuerySchema.extend({
    refresh: z.coerce.boolean().optional(),
})

export const updateAudioSchema = z.object({
    name: z.string().min(1).max(80),
})

export type UpdateAudioInput = z.infer<typeof updateAudioSchema>

// multipart não usa `body` do Fastify - campos de texto (enviados ANTES do arquivo, ver
// audios.controller.ts) são validados manualmente com esse schema
export const createAudioFieldsSchema = z.object({
    name: z.string().min(1).max(80),
    companyId: z.cuid2(),
})

export const createAudioTtsSchema = z.object({
    name: z.string().min(1).max(80),
    companyId: z.cuid2(),
    text: z.string().min(1).max(2500),
    voiceId: z.string().min(1),
    language: z.enum(['pt', 'en']).default('pt'),
})

export const voicePreviewQuerySchema = z.object({
    companyId: z.cuid2(),
    voiceId: z.string().min(1),
    language: z.enum(['pt', 'en']).default('pt'),
})

export const AudioSchema = z.object({
    id: z.string(),
    name: z.string(),
    companyId: z.string(),
    source: z.enum(['UPLOAD', 'TTS']),
    ttsText: z.string().nullable(),
    ttsVoiceId: z.string().nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const VoiceSchema = z.object({
    voiceId: z.string(),
    name: z.string(),
    previewUrl: z.string().nullable(),
    languages: z.array(z.string()),
})

export const ListAudiosResponse = ok({ message: z.string(), audios: z.array(AudioSchema) })
export const GetAudioResponse = ok({ message: z.string(), audio: AudioSchema })
export const CreateAudioResponse = ok({ message: z.string(), audioId: z.string() })
export const CreateAudioTtsResponse = ok({ message: z.string(), audioId: z.string() })
export const UpdateAudioResponse = ok({ message: z.string() })
export const ListVoicesResponse = ok({ message: z.string(), voices: z.array(VoiceSchema) })
