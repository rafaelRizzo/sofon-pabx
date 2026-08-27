import { validateEnv } from '../../../config/env'
import { logger } from '../../../utils/logger'
import { AppError } from '../../../utils/errors/app.error'

const env = validateEnv()

export type ElevenLabsVoice = { voiceId: string; name: string; previewUrl: string | null; languages: string[] }

type RawVoice = {
    voice_id: string
    name: string
    preview_url?: string | null
    labels?: { language?: string }
    verified_languages?: { language: string }[]
}

// verified_languages é a fonte mais confiável de idioma por voz (voz multilíngue pode suportar
// várias); labels.language é fallback pras vozes premade mais antigas que não têm verified_languages
function extractLanguages(v: RawVoice): string[] {
    const fromVerified = (v.verified_languages ?? []).map((l) => l.language).filter(Boolean)
    if (fromVerified.length > 0) return [...new Set(fromVerified)]
    return v.labels?.language ? [v.labels.language] : []
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, event: string): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), env.ELEVENLABS_TIMEOUT_MS)
    try {
        return await fn(controller.signal)
    } catch (error) {
        if (error instanceof AppError) throw error
        const isAbort = error instanceof Error && error.name === 'AbortError'
        logger.warn({ event, error: error instanceof Error ? error.message : String(error) })
        if (isAbort) throw new AppError('ElevenLabs request timed out', 504)
        throw new AppError('Failed to reach ElevenLabs', 502)
    } finally {
        clearTimeout(timeout)
    }
}

export async function listVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
    return withTimeout(async (signal) => {
        const res = await fetch(`${env.ELEVENLABS_API_URL}/v1/voices`, {
            headers: { 'xi-api-key': apiKey },
            signal,
        })
        if (!res.ok) {
            logger.warn({ event: 'elevenlabs.voices.error', status: res.status })
            if (res.status === 401) throw new AppError('Invalid ElevenLabs API key', 400)
            throw new AppError('Failed to fetch voices from ElevenLabs', 502)
        }
        const data = (await res.json()) as { voices: RawVoice[] }
        return data.voices.map((v) => ({
            voiceId: v.voice_id,
            name: v.name,
            previewUrl: v.preview_url ?? null,
            languages: extractLanguages(v),
        }))
    }, 'elevenlabs.voices.error')
}

// Ajuste moderado a partir do default da ElevenLabs (0.5/0.75), válido pra qualquer tamanho de
// texto (saudação curta, menu de URA, anúncio longo): stability um pouco mais alta reduz a
// variação errática de entonação - mais perceptível em frases curtas (poucas sílabas = pouco
// contexto pro modelo), mas sem travar a prosódia de textos longos (stability extrema, tipo
// 0.85+, é que soaria monótona ali). similarity_boost mais alto mantém o timbre fiel à voz
// original em qualquer duração. style em 0 (exagero emocional só soma risco de distorção, sem
// ganho pro caso de uso) e use_speaker_boost ligado (latência não importa, geração é única/
// assíncrona, não streaming ao vivo).
const VOICE_SETTINGS = { stability: 0.65, similarity_boost: 0.85, style: 0, use_speaker_boost: true }

export async function textToSpeech(apiKey: string, voiceId: string, text: string, language: 'pt' | 'en'): Promise<Buffer> {
    return withTimeout(async (signal) => {
        // language_code (ISO 639-1) força o idioma em vez de depender de auto-detecção - evita
        // ambiguidade em textos curtos, mas não distingue variante (pt-BR vs pt-PT, sem suporte
        // na API). Não suportado em multilingual_v2, só nos modelos mais novos (v3, turbo/flash).
        const requestBody: Record<string, unknown> = { text, model_id: env.ELEVENLABS_MODEL_ID, voice_settings: VOICE_SETTINGS }
        if (env.ELEVENLABS_MODEL_ID !== 'eleven_multilingual_v2') requestBody.language_code = language

        const res = await fetch(`${env.ELEVENLABS_API_URL}/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
            method: 'POST',
            headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal,
        })
        if (!res.ok) {
            const body = await res.text().catch(() => '')
            logger.warn({ event: 'elevenlabs.tts.error', status: res.status, body: body.slice(0, 500) })
            if (res.status === 401) throw new AppError('Invalid ElevenLabs API key', 400)
            if (res.status === 429) throw new AppError('ElevenLabs quota exceeded', 429)
            if (res.status >= 400 && res.status < 500) throw new AppError('ElevenLabs rejected the request', 400)
            throw new AppError('Failed to generate audio with ElevenLabs', 502)
        }
        return Buffer.from(await res.arrayBuffer())
    }, 'elevenlabs.tts.error')
}
