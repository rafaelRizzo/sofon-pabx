import { cacheManager, type CacheConfig } from '../../../utils/cache/cache.manager'

const NAMESPACE = 'plans'
const PLANS_LIST_KEY = 'all'

export class PlansCache {
    static async getPlan(planId: string) {
        return cacheManager.get(`${NAMESPACE}:plan`, planId)
    }

    static async setPlan(planId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:plan`, planId, data, config)
    }

    static async getAllPlans() {
        return cacheManager.get(`${NAMESPACE}:list`, PLANS_LIST_KEY)
    }

    static async setAllPlans(data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:list`, PLANS_LIST_KEY, data, config)
    }

    static async invalidatePlan(planId: string) {
        await cacheManager.invalidateByKey(`${NAMESPACE}:plan:${planId}`)
    }

    static async invalidateAllPlans() {
        await cacheManager.invalidateByKey(`${NAMESPACE}:list:${PLANS_LIST_KEY}`)
    }

    static async invalidatePlansNamespace() {
        await cacheManager.invalidate(NAMESPACE)
    }
}
