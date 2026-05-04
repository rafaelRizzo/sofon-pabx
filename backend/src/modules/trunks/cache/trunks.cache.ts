import { cacheManager, type CacheConfig } from '../../../utils/cache/cache.manager'

const NAMESPACE = 'trunks'

export class TrunksCache {
    static async getTrunk(trunkId: string) {
        return cacheManager.get(`${NAMESPACE}:trunk`, trunkId)
    }

    static async setTrunk(trunkId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:trunk`, trunkId, data, config)
    }

    static async getCompanyTrunks(companyId: string) {
        return cacheManager.get(`${NAMESPACE}:company`, companyId)
    }

    static async setCompanyTrunks(companyId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:company`, companyId, data, config)
    }

    static async getAllTrunks() {
        return cacheManager.get(`${NAMESPACE}:all`, 'list')
    }

    static async setAllTrunks(data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:all`, 'list', data, config)
    }

    static async invalidateTrunk(trunkId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:trunk:${trunkId}`)
    }

    static async invalidateCompanyTrunks(companyId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:company:${companyId}`)
    }

    static async invalidateAllTrunks() {
        await cacheManager.invalidateByKey(`${NAMESPACE}:all:list`)
    }

    static async invalidateTrunksNamespace() {
        await cacheManager.invalidate(NAMESPACE)
    }
}
