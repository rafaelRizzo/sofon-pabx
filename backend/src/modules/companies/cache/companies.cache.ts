import { cacheManager, type CacheConfig } from '../../../config/cache'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'companies'

export class CompaniesCache {
    static async getCompany<T = unknown>(id: string) {
        const cached = await cacheManager.get<T>(`${NAMESPACE}:company`, id)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `company:${id}`,
        })
        return cached
    }

    static async setCompany(id: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:company`, id, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `company:${id}`,
        })
    }

    static async getAllCompanies() {
        const cached = await cacheManager.get(`${NAMESPACE}:list`, 'all')
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`,
        })
        return cached
    }

    static async setAllCompanies(data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:list`, 'all', data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`,
        })
    }

    static async invalidateCompany(id: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:company:${id}`)
        logger.info({
            event: 'cache.invalidate',
            namespace: NAMESPACE,
            key: `company:${id}`,
        })
    }

    static async invalidateAllCompanies() {
        await cacheManager.invalidateByKey(`${NAMESPACE}:list:all`)
        logger.info({
            event: 'cache.invalidate',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`,
        })
    }

    static async getCompaniesByUser(userId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:user`, userId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `user:${userId}`,
        })
        return cached
    }

    static async setCompaniesByUser(userId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:user`, userId, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `user:${userId}`,
        })
    }

    static async invalidateCompaniesByUser(userId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:user:${userId}`)
        logger.info({
            event: 'cache.invalidate',
            namespace: NAMESPACE,
            key: `user:${userId}`,
        })
    }

    // Lista de /companies já filtrada pelo escopo (req.scope.companyIds) de um usuário não-admin -
    // getAllCompanies() com companyIds preenchido não bate no cache "list:all" (que é só pra admin)
    static async getCompaniesForScope(userId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:scope`, userId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `scope:${userId}`,
        })
        return cached
    }

    static async setCompaniesForScope(userId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:scope`, userId, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `scope:${userId}`,
        })
    }

    static async invalidateCompaniesForScope(userId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:scope:${userId}`)
        logger.info({
            event: 'cache.invalidate',
            namespace: NAMESPACE,
            key: `scope:${userId}`,
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
