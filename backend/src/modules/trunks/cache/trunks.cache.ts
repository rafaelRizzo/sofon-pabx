import { cacheManager, type CacheConfig } from '../../../config/cache'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'trunks'

export class TrunksCache {
    static async getAll() {
        const cached = await cacheManager.get(`${NAMESPACE}:all`, 'list')
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: 'all:list' })
        return cached
    }

    static async setAll(data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:all`, 'list', data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: 'all:list' })
    }

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

    static async getTrunk<T = unknown>(id: string) {
        const cached = await cacheManager.get<T>(`${NAMESPACE}:trunk`, id)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `trunk:${id}` })
        return cached
    }

    static async setTrunk(id: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:trunk`, id, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `trunk:${id}` })
    }

    static async invalidateTrunk(id: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:trunk:${id}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `trunk:${id}` })
    }

    static async invalidateAllTrunks() {
        await cacheManager.invalidate(NAMESPACE)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: 'all' })
    }
}
