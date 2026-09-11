import { cacheManager, type CacheConfig } from '../../../config/cache'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'request-templates'

export class RequestTemplatesCache {
    static async getAll() {
        const cached = await cacheManager.get(`${NAMESPACE}:all`, 'list')
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: 'all:list',
        })
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

    static async getTemplate(id: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:template`, id)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `template:${id}`,
        })
        return cached
    }

    static async setTemplate(id: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:template`, id, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `template:${id}` })
    }

    static async invalidateTemplate(id: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:template:${id}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `template:${id}` })
    }

    static async getByCompany(companyId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:company`, companyId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `company:${companyId}`,
        })
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

    static async invalidateNamespace() {
        await cacheManager.invalidate(NAMESPACE)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: 'all' })
    }

    // Linha própria (key "agi-template", não "template") pra não misturar com getTemplate/setTemplate
    // acima: aquele cacheia o DTO enriquecido (onSuccess/onError/usedBy) que a tela usa, este cacheia
    // só a linha crua que o AGI server precisa - shapes diferentes no mesmo id quebrariam um dos dois
    // lados se compartilhassem chave. Ver uso em asterisk/transport/agi-server.ts.
    static async getAgiTemplate(id: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:agi-template`, id)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `agi-template:${id}` })
        return cached
    }

    static async setAgiTemplate(id: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:agi-template`, id, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `agi-template:${id}` })
    }

    static async invalidateAgiTemplate(id: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:agi-template:${id}`)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `agi-template:${id}` })
    }
}
