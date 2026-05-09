import { cacheManager, type CacheConfig } from '../../../utils/cache/cache.manager'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'users'
const USERS_LIST_KEY = 'all'

export class UsersCache {
    static async getUser(userId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:user`, userId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `user:${userId}`
        })
        return cached
    }

    static async setUser(userId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:user`, userId, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `user:${userId}`
        })
    }

    static async getAllUsers() {
        const cached = await cacheManager.get(`${NAMESPACE}:list`, USERS_LIST_KEY)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`
        })
        return cached
    }

    static async setAllUsers(data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:list`, USERS_LIST_KEY, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`
        })
    }

    static async invalidateUser(userId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:user:${userId}`)
    }

    static async invalidateAllUsers() {
        await cacheManager.invalidateByKey(`${NAMESPACE}:list:${USERS_LIST_KEY}`)
    }

    static async invalidateUsersNamespace() {
        await cacheManager.invalidate(NAMESPACE)
    }
}
