import { cacheManager, type CacheConfig } from '../../../config/cache'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'time-conditions'

export class TimeConditionsCache {
    static async getByCompany(companyId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:company`, companyId)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `company:${companyId}` })
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

    static async getTimeCondition(id: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:item`, id)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `item:${id}` })
        return cached
    }

    static async setTimeCondition(id: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:item`, id, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `item:${id}` })
    }

    static async invalidateTimeCondition(id: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:item:${id}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `item:${id}` })
    }

    static async invalidateNamespace() {
        await cacheManager.invalidate(NAMESPACE)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: 'all' })
    }
}
