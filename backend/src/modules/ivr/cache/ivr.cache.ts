import { cacheManager, type CacheConfig } from '../../../config/cache'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'ivr'

export class IvrCache {
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

    static async getMenu(id: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:menu`, id)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `menu:${id}`,
        })
        return cached
    }

    static async setMenu(id: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:menu`, id, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `menu:${id}` })
    }

    static async invalidateMenu(id: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:menu:${id}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `menu:${id}` })
    }

    static async invalidateNamespace() {
        await cacheManager.invalidate(NAMESPACE)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: 'all' })
    }
}
