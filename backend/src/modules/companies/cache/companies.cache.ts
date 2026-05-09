import { cacheManager, type CacheConfig } from '../../../utils/cache/cache.manager'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'companies'
const COMPANIES_LIST_KEY = 'all'

export class CompaniesCache {
    static async getCompany(companyId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:company`, companyId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `company:${companyId}`
        })
        return cached
    }

    static async setCompany(companyId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:company`, companyId, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `company:${companyId}`
        })
    }

    static async getAllCompanies() {
        const cached = await cacheManager.get(`${NAMESPACE}:list`, COMPANIES_LIST_KEY)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`
        })
        return cached
    }

    static async setAllCompanies(data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:list`, COMPANIES_LIST_KEY, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`
        })
    }

    static async invalidateCompany(companyId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:company:${companyId}`)
    }

    static async invalidateAllCompanies() {
        await cacheManager.invalidateByKey(`${NAMESPACE}:list:${COMPANIES_LIST_KEY}`)
    }

    static async invalidateCompaniesNamespace() {
        await cacheManager.invalidate(NAMESPACE)
    }
}
