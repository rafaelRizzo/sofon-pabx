import { cacheManager, type CacheConfig } from '../../../config/cache'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'queue-members'

export class QueueMembersCache {
    static async getMembers(queueId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:members`, queueId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `members:${queueId}`,
        })
        return cached
    }

    static async setMembers(queueId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:members`, queueId, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `members:${queueId}` })
    }

    static async invalidateMembers(queueId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:members:${queueId}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `members:${queueId}` })
    }

    static async invalidateNamespace() {
        await cacheManager.invalidate(NAMESPACE)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: 'all' })
    }
}
