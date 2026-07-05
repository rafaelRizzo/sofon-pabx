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
}
