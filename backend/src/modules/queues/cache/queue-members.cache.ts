import { cacheManager, type CacheConfig } from '../../../utils/cache/cache.manager'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'queues'
const MEMBERS_PREFIX = 'members'

export class QueueMembersCache {
    static async getQueueMembers(queueId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:${MEMBERS_PREFIX}`, queueId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `members:${queueId}`
        })
        return cached
    }

    static async setQueueMembers(queueId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:${MEMBERS_PREFIX}`, queueId, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `members:${queueId}`
        })
    }

    static async invalidateQueueMembers(queueId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:${MEMBERS_PREFIX}:${queueId}`)
        logger.info({
            event: 'cache.invalidate',
            namespace: NAMESPACE,
            key: `members:${queueId}`
        })
    }
}
