import { cacheManager, type CacheConfig } from '../../../config/cache'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'audios'

export class AudiosCache {
    static async getByCompany(companyId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:company`, companyId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `company:${companyId}`,
        })
        return cached
    }

    static async setByCompany(companyId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:company`, companyId, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `company:${companyId}` })
    }

    static async invalidateByCompany(companyId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:company:${companyId}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `company:${companyId}` })
    }

    static async getAudio(id: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:audio`, id)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `audio:${id}`,
        })
        return cached
    }

    static async setAudio(id: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:audio`, id, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `audio:${id}` })
    }

    static async invalidateAudio(id: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:audio:${id}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `audio:${id}` })
    }

    static async invalidateNamespace() {
        await cacheManager.invalidate(NAMESPACE)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: 'all' })
    }

    // Vozes da ElevenLabs — cada empresa tem sua própria conta/key, então cacheado por companyId
    static async getVoices(companyId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:voices`, companyId)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `voices:${companyId}` })
        return cached
    }

    static async setVoices(companyId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:voices`, companyId, data, config ?? { ttl: 3600 })
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `voices:${companyId}` })
    }

    // Prévia de voz em base64 (frase curta gerada sob demanda) — cacheada por 7 dias por
    // empresa+voz+idioma pra não gastar cota da ElevenLabs a cada clique no play da lista
    static async getVoicePreview(companyId: string, voiceId: string, language: string) {
        const key = `${companyId}:${voiceId}:${language}`
        const cached = await cacheManager.get<string>(`${NAMESPACE}:preview`, key)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `preview:${key}` })
        return cached
    }

    static async setVoicePreview(companyId: string, voiceId: string, language: string, base64: string) {
        const key = `${companyId}:${voiceId}:${language}`
        await cacheManager.set(`${NAMESPACE}:preview`, key, base64, { ttl: 604800 })
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `preview:${key}` })
    }
}
