import { cacheManager, type CacheConfig } from '../../../config/cache'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'integration-credentials'

export class IntegrationCredentialsCache {
    static async getByCompany(cacheKey: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:company`, cacheKey)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `company:${cacheKey}`,
        })
        return cached
    }

    static async setByCompany(cacheKey: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:company`, cacheKey, data, config)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `company:${cacheKey}` })
    }

    static async invalidateByCompany(companyId: string) {
        // invalida tanto a chave sem provider quanto qualquer variante `companyId:provider`
        // cacheada - mais simples invalidar o namespace inteiro do que rastrear providers usados
        await cacheManager.invalidate(NAMESPACE)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `company:${companyId}` })
    }
}
