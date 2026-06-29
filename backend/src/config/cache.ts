import NodeCache from 'node-cache'
import { logger } from '../utils/logger'

interface CacheConfig {
    ttl?: number
}

const store = new NodeCache({ stdTTL: 0, checkperiod: 600, useClones: false })

class CacheManager {
    get<T>(namespace: string, key: string): Promise<T | null> {
        try {
            const fullKey = `${namespace}:${key}`
            const value = store.get<T>(fullKey)
            return Promise.resolve(value !== undefined ? value : null)
        } catch (error) {
            logger.error({ event: 'cache.get.error', namespace, key, error: error instanceof Error ? error.message : String(error) })
            return Promise.resolve(null)
        }
    }

    set<T>(namespace: string, key: string, value: T, config?: CacheConfig): Promise<void> {
        try {
            const fullKey = `${namespace}:${key}`
            store.set(fullKey, value, config?.ttl ?? 0)
        } catch (error) {
            logger.error({ event: 'cache.set.error', namespace, key, error: error instanceof Error ? error.message : String(error) })
        }
        return Promise.resolve()
    }

    invalidateByKey(key: string): Promise<void> {
        try {
            store.del(key)
        } catch (error) {
            logger.error({ event: 'cache.invalidate.error', key, error: error instanceof Error ? error.message : String(error) })
        }
        return Promise.resolve()
    }

    invalidate(namespace: string): Promise<void> {
        try {
            const prefix = `${namespace}:`
            const matched = store.keys().filter((k) => k.startsWith(prefix))
            if (matched.length > 0) store.del(matched)
        } catch (error) {
            logger.error({ event: 'cache.invalidate_namespace.error', namespace, error: error instanceof Error ? error.message : String(error) })
        }
        return Promise.resolve()
    }

    clear(): Promise<void> {
        store.flushAll()
        return Promise.resolve()
    }
}

export const cacheManager = new CacheManager()
export type { CacheConfig }
