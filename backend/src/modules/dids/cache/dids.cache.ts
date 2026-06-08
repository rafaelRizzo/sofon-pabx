import { cacheManager, type CacheConfig } from '../../../config/cache'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'dids'

export class DidsCache {
    static async getDid(id: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:did`, id)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `did:${id}`,
        })
        return cached
    }

    static async setDid(id: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:did`, id, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `did:${id}` })
    }

    static async getDidsByCompany(companyId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:company`, companyId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `company:${companyId}`,
        })
        return cached
    }

    static async setDidsByCompany(companyId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:company`, companyId, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `company:${companyId}` })
    }

    static async invalidateDid(id: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:did:${id}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `did:${id}` })
    }

    static async invalidateDidsByCompany(companyId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:company:${companyId}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `company:${companyId}` })
    }

    static async invalidateNamespace() {
        await cacheManager.invalidate(NAMESPACE)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: 'all' })
    }
}
