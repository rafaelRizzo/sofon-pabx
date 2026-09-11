import { cacheManager, type CacheConfig } from '../../../config/cache'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'variable-conditions'

export class VariableConditionsCache {
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

    static async getVariableCondition(id: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:item`, id)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `item:${id}` })
        return cached
    }

    static async setVariableCondition(id: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:item`, id, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `item:${id}` })
    }

    static async invalidateVariableCondition(id: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:item:${id}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `item:${id}` })
    }

    static async invalidateNamespace() {
        await cacheManager.invalidate(NAMESPACE)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: 'all' })
    }

    // Linha própria (key "agi-item") - getVariableCondition/setVariableCondition acima cacheiam o
    // DTO enriquecido (trueRoute/falseRoute/usedBy) da tela; o AGI server só precisa da linha crua.
    static async getAgiVariableCondition(id: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:agi-item`, id)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `agi-item:${id}` })
        return cached
    }

    static async setAgiVariableCondition(id: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:agi-item`, id, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `agi-item:${id}` })
    }

    static async invalidateAgiVariableCondition(id: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:agi-item:${id}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `agi-item:${id}` })
    }
}
