import { cacheManager, type CacheConfig } from '../../../config/cache'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'time-conditions'

export class TimeConditionsCache {
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

    static async getTimeCondition(id: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:item`, id)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `item:${id}` })
        return cached
    }

    static async setTimeCondition(id: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:item`, id, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `item:${id}` })
    }

    static async invalidateTimeCondition(id: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:item:${id}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `item:${id}` })
    }

    static async invalidateNamespace() {
        await cacheManager.invalidate(NAMESPACE)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: 'all' })
    }

    // Linha própria (key "agi-item") - getTimeCondition/setTimeCondition acima cacheiam o DTO da
    // tela; o AGI server precisa de um select com timeGroups.timeGroup.ranges aninhado (ver
    // handleTimeConditionCheck em agi-server.ts), shape incompatível com o cache de tela.
    static async getAgiTimeCondition(id: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:agi-item`, id)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `agi-item:${id}` })
        return cached
    }

    static async setAgiTimeCondition(id: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:agi-item`, id, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `agi-item:${id}` })
    }

    static async invalidateAgiTimeCondition(id: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:agi-item:${id}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `agi-item:${id}` })
    }
}
