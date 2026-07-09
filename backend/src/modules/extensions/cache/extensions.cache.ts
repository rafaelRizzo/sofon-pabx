import { cacheManager, type CacheConfig } from '../../../config/cache'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'extensions'

export class ExtensionsCache {
    static async getAllExtensions() {
        const cached = await cacheManager.get(`${NAMESPACE}:all`, 'list')
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: 'all' })
        return cached
    }

    static async setAllExtensions(data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:all`, 'list', data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: 'all' })
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

    // Lista de /extensions escopada por usuário não-admin com MAIS DE UMA empresa vinculada —
    // getByCompany (1 empresa) e getAllExtensions (admin) não cobrem esse caso.
    // Invalidada de forma ampla por invalidateAllExtensions() (prefixo "extensions:"), como os demais.
    static async getForScope(userId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:scope`, userId)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `scope:${userId}` })
        return cached
    }

    static async setForScope(userId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:scope`, userId, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `scope:${userId}` })
    }

    static async getExtension<T = unknown>(number: string) {
        const cached = await cacheManager.get<T>(`${NAMESPACE}:ext`, number)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `ext:${number}` })
        return cached
    }

    static async setExtension(number: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:ext`, number, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `ext:${number}` })
    }

    static async invalidateExtension(number: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:ext:${number}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `ext:${number}` })
    }

    static async invalidateAllExtensions() {
        await cacheManager.invalidate(NAMESPACE)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: 'all' })
    }

    static async getLiveDetails<T = unknown>(id: string) {
        const cached = await cacheManager.get<T>(`${NAMESPACE}:live`, id)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `live:${id}` })
        return cached
    }

    static async setLiveDetails(id: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:live`, id, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `live:${id}` })
    }

    static async invalidateLiveDetails(id: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:live:${id}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `live:${id}` })
    }
}
