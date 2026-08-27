import { cacheManager, type CacheConfig } from '../../../config/cache'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'inbound-routes'

export class InboundRoutesCache {
    static async getAll() {
        const cached = await cacheManager.get(`${NAMESPACE}:all`, 'list')
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: 'all:list' })
        return cached
    }

    static async setAll(data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:all`, 'list', data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: 'all:list' })
    }

    static async invalidateAll() {
        await cacheManager.invalidateByKey(`${NAMESPACE}:all:list`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: 'all:list' })
    }

    static async getByCompany(companyId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:company`, companyId)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `company:${companyId}` })
        return cached
    }

    static async setByCompany(companyId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:company`, companyId, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `company:${companyId}` })
    }

    static async invalidateByCompany(companyId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:company:${companyId}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `company:${companyId}` })
    }

    static async getRoute(id: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:item`, id)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `item:${id}` })
        return cached
    }

    static async setRoute(id: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:item`, id, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `item:${id}` })
    }

    static async invalidateRoute(id: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:item:${id}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `item:${id}` })
    }

    static async invalidateNamespace() {
        await cacheManager.invalidate(NAMESPACE)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: 'all' })
    }

    // Lista de /inbound-routes escopada por usuário não-admin com MAIS DE UMA empresa vinculada -
    // getByCompany (1 empresa) e getAll (admin) não cobrem esse caso. Invalidada de forma
    // ampla por invalidateNamespace() (prefixo "inbound-routes:"), como os demais.
    static async getForScope(userId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:scope`, userId)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `scope:${userId}` })
        return cached
    }

    static async setForScope(userId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:scope`, userId, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `scope:${userId}` })
    }
}
