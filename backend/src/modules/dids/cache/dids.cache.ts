import { cacheManager, type CacheConfig } from '../../../utils/cache/cache.manager'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'dids'
const DIDS_LIST_KEY = 'all'

export class DidsCache {
    static async getDid(didId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:item`, didId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `item:${didId}`
        })
        return cached
    }

    static async setDid(didId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:item`, didId, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `item:${didId}`
        })
    }

    static async getAllDids() {
        const cached = await cacheManager.get(`${NAMESPACE}:list`, DIDS_LIST_KEY)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`
        })
        return cached
    }

    static async setAllDids(data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:list`, DIDS_LIST_KEY, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`
        })
    }

    static async getDidsByCompany(companyId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:company`, companyId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `company:${companyId}`
        })
        return cached
    }

    static async setDidsByCompany(companyId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:company`, companyId, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `company:${companyId}`
        })
    }

    static async invalidateDid(didId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:item:${didId}`)
    }

    static async invalidateAllDids() {
        await cacheManager.invalidateByKey(`${NAMESPACE}:list:${DIDS_LIST_KEY}`)
    }

    static async invalidateDidsByCompany(companyId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:company:${companyId}`)
    }

    static async getDidsByOwner(ownerId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:owner`, ownerId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `owner:${ownerId}`
        })
        return cached
    }

    static async setDidsByOwner(ownerId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:owner`, ownerId, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `owner:${ownerId}`
        })
    }

    static async invalidateDidsByOwner(ownerId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:owner:${ownerId}`)
    }

    static async invalidateDidsNamespace() {
        await cacheManager.invalidate(NAMESPACE)
    }
}
