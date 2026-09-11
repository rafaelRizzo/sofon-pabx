import { cacheManager, type CacheConfig } from '../../../config/cache'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'formatter-nodes'

export class FormatterNodesCache {
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

    static async getNode(id: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:node`, id)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `node:${id}` })
        return cached
    }

    static async setNode(id: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:node`, id, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `node:${id}` })
    }

    static async invalidateNode(id: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:node:${id}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `node:${id}` })
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

    // Linha própria (key "agi-node") - getNode/setNode acima cacheiam o DTO enriquecido (onSuccess/
    // onError/usedBy) da tela; o AGI server só precisa da linha crua.
    static async getAgiNode(id: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:agi-node`, id)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `agi-node:${id}` })
        return cached
    }

    static async setAgiNode(id: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:agi-node`, id, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `agi-node:${id}` })
    }

    static async invalidateAgiNode(id: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:agi-node:${id}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `agi-node:${id}` })
    }
}
