import { cacheManager, type CacheConfig } from '../../../utils/cache/cache.manager'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'instances'
const INSTANCES_LIST_KEY = 'all'

export class InstancesCache {
    static async getInstance(instanceId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:item`, instanceId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `item:${instanceId}`
        })
        return cached
    }

    static async setInstance(instanceId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:item`, instanceId, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `item:${instanceId}`
        })
    }

    static async getAllInstances() {
        const cached = await cacheManager.get(`${NAMESPACE}:list`, INSTANCES_LIST_KEY)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`
        })
        return cached
    }

    static async setAllInstances(data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:list`, INSTANCES_LIST_KEY, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`
        })
    }

    static async getInstancesByCompany(companyId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:company`, companyId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `company:${companyId}`
        })
        return cached
    }

    static async setInstancesByCompany(companyId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:company`, companyId, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `company:${companyId}`
        })
    }

    static async invalidateInstance(instanceId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:item:${instanceId}`)
    }

    static async invalidateAllInstances() {
        await cacheManager.invalidateByKey(`${NAMESPACE}:list:${INSTANCES_LIST_KEY}`)
    }

    static async invalidateInstancesByCompany(companyId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:company:${companyId}`)
    }

    static async getInstancesByOwner(ownerId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:owner`, ownerId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `owner:${ownerId}`
        })
        return cached
    }

    static async setInstancesByOwner(ownerId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:owner`, ownerId, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `owner:${ownerId}`
        })
    }

    static async invalidateInstancesByOwner(ownerId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:owner:${ownerId}`)
    }

    static async invalidateInstancesNamespace() {
        await cacheManager.invalidate(NAMESPACE)
    }
}
