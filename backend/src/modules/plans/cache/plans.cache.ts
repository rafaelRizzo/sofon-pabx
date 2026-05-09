import { cacheManager, type CacheConfig } from '../../../utils/cache/cache.manager'
import { logger } from '../../../utils/logger'

const NAMESPACE = 'plans'
const PLANS_LIST_KEY = 'all'

export class PlansCache {
    static async getPlan(planId: string) {
        const cached = await cacheManager.get(`${NAMESPACE}:plan`, planId)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `plan:${planId}`
        })
        return cached
    }

    static async setPlan(planId: string, data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:plan`, planId, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `plan:${planId}`
        })
    }

    static async getAllPlans() {
        const cached = await cacheManager.get(`${NAMESPACE}:list`, PLANS_LIST_KEY)
        logger.info({
            event: cached ? 'cache.hit' : 'cache.miss',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`
        })
        return cached
    }

    static async setAllPlans(data: any, config?: CacheConfig) {
        await cacheManager.set(`${NAMESPACE}:list`, PLANS_LIST_KEY, data, config)
        logger.info({
            event: 'cache.set',
            namespace: NAMESPACE,
            key: `${NAMESPACE}:list`
        })
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
