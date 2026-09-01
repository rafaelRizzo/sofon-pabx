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
        // (isso também cobre as chaves `id:*` abaixo, mesmo namespace)
        await cacheManager.invalidate(NAMESPACE)
        logger.info({ event: 'cache.invalidate', namespace: NAMESPACE, key: `company:${companyId}` })
    }

    // Linha completa (com token cifrado) usada em tempo de chamada/teste - ver testIxcNode e
    // handleIxcNode. Chave por id, não por empresa, porque quem chama já tem o credentialId.
    static async getById(id: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:id`, id)
        logger.info({ event: cached ? 'cache.hit' : 'cache.miss', namespace: NAMESPACE, key: `id:${id}` })
        return cached
    }

    static async setById(id: string, data: any) {
        await cacheManager.set(`${NAMESPACE}:id`, id, data)
        logger.info({ event: 'cache.set', namespace: NAMESPACE, key: `id:${id}` })
    }
}
