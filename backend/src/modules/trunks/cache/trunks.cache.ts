import { cacheManager, type CacheConfig } from '../../../utils/cache/cache.manager'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'trunks'

export class TrunksCache {
    static async getTrunk(trunkId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:trunk`, trunkId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `trunk:${trunkId}`
        })
        return cached
    }

    static async setTrunk(trunkId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:trunk`, trunkId, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `trunk:${trunkId}`
        })
    }

    static async getCompanyTrunks(companyId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:company`, companyId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `company:${companyId}`
        })
        return cached
    }

    static async setCompanyTrunks(companyId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:company`, companyId, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `company:${companyId}`
        })
    }

    static async getAllTrunks() {
        const cached = await cacheManager.get(`${NAMESPACE}:all`, 'list')
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`
        })
        return cached
    }

    static async setAllTrunks(data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:all`, 'list', data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`
        })
    }

    static async invalidateTrunk(trunkId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:trunk:${trunkId}`)
    }

    static async invalidateCompanyTrunks(companyId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:company:${companyId}`)
    }

    static async invalidateAllTrunks() {
        await cacheManager.invalidateByKey(`${NAMESPACE}:all:list`)
    }

    static async invalidateTrunksNamespace() {
        await cacheManager.invalidate(NAMESPACE)
    }
}
