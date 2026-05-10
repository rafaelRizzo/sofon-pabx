import { cacheManager, type CacheConfig } from '../../../utils/cache/cache.manager'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'users'
const USERS_LIST_KEY = 'all'
const USERS_COUNT_KEY = 'count'

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

    static async getUserCount() {
        const cached = await cacheManager.get(`${NAMESPACE}:count`, USERS_COUNT_KEY)
        logger.info({
            event: cached !== null ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: 'count'
        })
        return cached
    }

    static async setUserCount(count: number, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:count`, USERS_COUNT_KEY, count, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: 'count'
        })
    }

    static async invalidateUserCount() {
        await cacheManager.invalidateByKey(`${NAMESPACE}:count:${USERS_COUNT_KEY}`)
    }
}
