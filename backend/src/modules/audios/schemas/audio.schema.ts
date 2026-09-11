import { z } from 'zod'
import { timestamp, cuidParam, ok } from '../../../schemas/responses'

export const idParamSchema = z.object({ id: cuidParam })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })
export const listVoicesQuerySchema = companyQuerySchema.extend({
    refresh: z.coerce.boolean().optional(),
})

export const updateAudioSchema = z.object({
    name: z.string().min(1).max(80),
    notes: z.string().max(10000).optional(),
})

export type UpdateAudioInput = z.infer<typeof updateAudioSchema>

// multipart não usa `body` do Fastify - campos de texto (enviados ANTES do arquivo, ver
// audios.controller.ts) são validados manualmente com esse schema
export const createAudioFieldsSchema = z.object({
    name: z.string().min(1).max(80),
    companyId: z.cuid2(),
    notes: z.string().max(10000).optional(),
})

// Espelha voice_settings da ElevenLabs (ver providers/elevenlabs.provider.ts) - todos opcionais,
// campo omitido cai no default do provider. `speed` é o único fora do range 0-1 (0.7-1.2 na API).
export const ttsVoiceSettingsSchema = z.object({
    stability: z.number().min(0).max(1).optional(),
    similarityBoost: z.number().min(0).max(1).optional(),
    style: z.number().min(0).max(1).optional(),
    speed: z.number().min(0.7).max(1.2).optional(),
    speakerBoost: z.boolean().optional(),
})

export type TtsVoiceSettingsInput = z.infer<typeof ttsVoiceSettingsSchema>

export const createAudioTtsSchema = z.object({
    name: z.string().min(1).max(80),
    companyId: z.cuid2(),
    text: z.string().min(1).max(2500),
    voiceId: z.string().min(1),
    language: z.enum(['pt', 'en']).default('pt'),
    voiceSettings: ttsVoiceSettingsSchema.optional(),
    notes: z.string().max(10000).optional(),
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
    ttsSettings: ttsVoiceSettingsSchema.nullable(),
    notes: z.string().nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const VoiceSchema = z.object({
    voiceId: z.string(),
    name: z.string(),
    previewUrl: z.string().nullable(),
    languages: z.array(z.string()),
    accent: z.string().nullable(),
    gender: z.string().nullable(),
    age: z.string().nullable(),
    description: z.string().nullable(),
})

export const SubscriptionSchema = z.object({
    tier: z.string(),
    characterCount: z.number(),
    characterLimit: z.number(),
    canExtendCharacterLimit: z.boolean(),
    nextCharacterCountResetUnix: z.number().nullable(),
    status: z.string(),
    currency: z.string(),
    voiceSlotsUsed: z.number(),
    voiceLimit: z.number(),
})

export const ListAudiosResponse = ok({ message: z.string(), audios: z.array(AudioSchema) })
export const GetAudioResponse = ok({ message: z.string(), audio: AudioSchema })
export const CreateAudioResponse = ok({ message: z.string(), audioId: z.string() })
export const CreateAudioTtsResponse = ok({ message: z.string(), audioId: z.string() })
export const UpdateAudioResponse = ok({ message: z.string() })
export const ListVoicesResponse = ok({ message: z.string(), voices: z.array(VoiceSchema) })
export const GetSubscriptionResponse = ok({ message: z.string(), subscription: SubscriptionSchema })
