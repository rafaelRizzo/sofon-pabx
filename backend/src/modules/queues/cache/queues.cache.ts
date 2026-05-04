import { cacheManager, type CacheConfig } from '../../../utils/cache/cache.manager'

const NAMESPACE = 'queues'

export class QueuesCache {
    static async getQueue(queueId: string) {
        return cacheManager.get(`${NAMESPACE}:queue`, queueId)
    }

    static async setQueue(queueId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:queue`, queueId, data, config)
    }

    static async getCompanyQueues(companyId: string) {
        return cacheManager.get(`${NAMESPACE}:company`, companyId)
    }

    static async setCompanyQueues(companyId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:company`, companyId, data, config)
    }

    static async getAllQueues() {
        return cacheManager.get(`${NAMESPACE}:all`, 'list')
    }

    static async setAllQueues(data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:all`, 'list', data, config)
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
