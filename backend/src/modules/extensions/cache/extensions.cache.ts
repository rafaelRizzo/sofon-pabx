import { cacheManager, type CacheConfig } from '../../../utils/cache/cache.manager'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'extensions'

export class ExtensionsCache {
    static async getExtension(extensionId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:ext`, extensionId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `ext:${extensionId}`
        })
        return cached
    }

    static async setExtension(extensionId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:ext`, extensionId, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `ext:${extensionId}`
        })
    }

    static async getCompanyExtensions(companyId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:company`, companyId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `company:${companyId}`
        })
        return cached
    }

    static async setCompanyExtensions(companyId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:company`, companyId, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `company:${companyId}`
        })
    }

    static async getAllExtensions() {
        const cached = await cacheManager.get(`${NAMESPACE}:all`, 'list')
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`
        })
        return cached
    }

    static async setAllExtensions(data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:all`, 'list', data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`
        })
    }

    static async invalidateExtension(extensionId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:ext:${extensionId}`)
    }

    static async invalidateCompanyExtensions(companyId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:company:${companyId}`)
    }

    static async invalidateAllExtensions() {
        await cacheManager.invalidateByKey(`${NAMESPACE}:all:list`)
    }

    static async invalidateExtensionsNamespace() {
        await cacheManager.invalidate(NAMESPACE)
    }
}
