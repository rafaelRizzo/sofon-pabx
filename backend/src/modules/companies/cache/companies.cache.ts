import { cacheManager, type CacheConfig } from '../../../utils/cache/cache.manager'

const NAMESPACE = 'companies'
const COMPANIES_LIST_KEY = 'all'

export class CompaniesCache {
    static async getCompany(companyId: string) {
        return cacheManager.get(`${NAMESPACE}:company`, companyId)
    }

    static async setCompany(companyId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:company`, companyId, data, config)
    }

    static async getAllCompanies() {
        return cacheManager.get(`${NAMESPACE}:list`, COMPANIES_LIST_KEY)
    }

    static async setAllCompanies(data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:list`, COMPANIES_LIST_KEY, data, config)
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
