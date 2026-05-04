import { cacheManager, type CacheConfig } from '../../../utils/cache/cache.manager'

const NAMESPACE = 'extensions'

export class ExtensionsCache {
    static async getExtension(extensionId: string) {
        return cacheManager.get(`${NAMESPACE}:ext`, extensionId)
    }

    static async setExtension(extensionId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:ext`, extensionId, data, config)
    }

    static async getCompanyExtensions(companyId: string) {
        return cacheManager.get(`${NAMESPACE}:company`, companyId)
    }

    static async setCompanyExtensions(companyId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:company`, companyId, data, config)
    }

    static async getAllExtensions() {
        return cacheManager.get(`${NAMESPACE}:all`, 'list')
    }

    static async setAllExtensions(data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:all`, 'list', data, config)
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
