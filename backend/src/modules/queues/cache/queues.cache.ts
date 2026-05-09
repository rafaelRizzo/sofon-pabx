import { cacheManager, type CacheConfig } from '../../../utils/cache/cache.manager'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'queues'

export class QueuesCache {
    static async getQueue(queueId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:queue`, queueId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `queue:${queueId}`
        })
        return cached
    }

    static async setQueue(queueId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:queue`, queueId, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `queue:${queueId}`
        })
    }

    static async getCompanyQueues(companyId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:company`, companyId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `company:${companyId}`
        })
        return cached
    }

    static async setCompanyQueues(companyId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:company`, companyId, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `company:${companyId}`
        })
    }

    static async getAllQueues() {
        const cached = await cacheManager.get(`${NAMESPACE}:all`, 'list')
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`
        })
        return cached
    }

    static async setAllQueues(data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:all`, 'list', data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`
        })
    }

    static async invalidateQueue(queueId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:queue:${queueId}`)
    }

    static async invalidateCompanyQueues(companyId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:company:${companyId}`)
    }

    static async invalidateAllQueues() {
        await cacheManager.invalidateByKey(`${NAMESPACE}:all:list`)
    }

    static async invalidateQueuesNamespace() {
        await cacheManager.invalidate(NAMESPACE)
    }
}
