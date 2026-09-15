import { cacheManager, type CacheConfig } from '../../../config/cache'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'users'

export class UsersCache {
    static async getUser(id: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:user`, id)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `user:${id}`,
        })
        return cached
    }

    static async setUser(id: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:user`, id, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `user:${id}`,
        })
    }

    static async getAllUsers() {
        const cached = await cacheManager.get(`${NAMESPACE}:list`, 'all')
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`,
        })
        return cached
    }

    static async setAllUsers(data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:list`, 'all', data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`,
        })
    }

    static async invalidateUser(id: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:user:${id}`)
        logger.info({
            event: 'cache.invalidate',
            namespace: NAMESPACE,
            key: `user:${id}`,
        })
    }

    static async invalidateAllUsers() {
        await cacheManager.invalidateByKey(`${NAMESPACE}:list:all`)
        logger.info({
            event: 'cache.invalidate',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`,
        })
    }

    static async invalidateNamespace() {
        await cacheManager.invalidate(NAMESPACE)
        logger.info({
            event: 'cache.invalidate',
            namespace: NAMESPACE,
            key: 'all',
        })
    }
}
