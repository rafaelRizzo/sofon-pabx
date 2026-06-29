import { cacheManager, type CacheConfig } from '../../../config/cache'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'outbound-routes'

export class OutboundRoutesCache {
    static async getByCompany(companyId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:company`, companyId)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `company:${companyId}` })
        return cached
    }

    static async setByCompany(companyId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:company`, companyId, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `company:${companyId}` })
    }

    static async getRoute<T = unknown>(id: string) {
        const cached = await cacheManager.get<T>(`${NAMESPACE}:route`, id)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `route:${id}` })
        return cached
    }

    static async setRoute(id: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:route`, id, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `route:${id}` })
    }

    static async invalidateRoute(id: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:route:${id}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `route:${id}` })
    }

    static async invalidateByCompany(companyId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:company:${companyId}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `company:${companyId}` })
    }

    static async invalidateAll() {
        await cacheManager.invalidate(NAMESPACE)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: 'all' })
    }
}
