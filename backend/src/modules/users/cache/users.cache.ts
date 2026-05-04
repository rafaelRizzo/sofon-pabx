import { cacheManager, type CacheConfig } from '../../../utils/cache/cache.manager'

const NAMESPACE = 'users'
const USERS_LIST_KEY = 'all'

export class UsersCache {
    static async getUser(userId: string) {
        return cacheManager.get(`${NAMESPACE}:user`, userId)
    }

    static async setUser(userId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:user`, userId, data, config)
    }

    static async getAllUsers() {
        return cacheManager.get(`${NAMESPACE}:list`, USERS_LIST_KEY)
    }

    static async setAllUsers(data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:list`, USERS_LIST_KEY, data, config)
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
