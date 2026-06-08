import { redisClient } from './redis'
import { logger } from '../utils/logger'

interface CacheConfig {
    ttl?: number
}

class CacheManager {
    async get<T>(namespace: string, key: string): Promise<T | null> {
        try {
            const fullKey = `${namespace}:${key}`
            const value = await redisClient.get(fullKey)
            return value ? (JSON.parse(value) as T) : null
        } catch (error) {
            logger.error({
                event: 'cache.get.error',
                namespace,
                key,
                error: error instanceof Error ? error.message : String(error),
            })
            return null
        }
    }

    async set<T>(namespace: string, key: string, value: T, config?: CacheConfig): Promise<void> {
        try {
            const fullKey = `${namespace}:${key}`
            const serialized = JSON.stringify(value)
            if (config?.ttl) {
                await redisClient.setEx(fullKey, config.ttl, serialized)
            } else {
                await redisClient.set(fullKey, serialized)
            }
        } catch (error) {
            logger.error({
                event: 'cache.set.error',
                namespace,
                key,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async invalidateByKey(key: string): Promise<void> {
        try {
            await redisClient.del(key)
        } catch (error) {
            logger.error({
                event: 'cache.invalidate.error',
                key,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async invalidate(namespace: string): Promise<void> {
        try {
            const pattern = `${namespace}:*`
            const keys = await redisClient.keys(pattern)
            if (keys.length > 0) {
                await redisClient.del(keys)
            }
        } catch (error) {
            logger.error({
                event: 'cache.invalidate_namespace.error',
                namespace,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async clear(): Promise<void> {
        try {
            await redisClient.flushAll()
        } catch (error) {
            logger.error({
                event: 'cache.clear.error',
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }
}

export const cacheManager = new CacheManager()
export type { CacheConfig }
