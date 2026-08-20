import { redisClient } from './redis'
import { logger } from '../utils/logger'

interface CacheConfig {
    ttl?: number
}

// Prefixo próprio pra nunca colidir com as chaves `jti:*` (auth middleware, mesma instância Redis)
// e pra invalidate()/clear() conseguirem fazer SCAN só no universo de cache de entidades.
const PREFIX = 'cache:'

class CacheManager {
    async get<T>(namespace: string, key: string): Promise<T | null> {
        try {
            const raw = await redisClient.get(`${PREFIX}${namespace}:${key}`)
            return raw ? (JSON.parse(raw) as T) : null
        } catch (error) {
            logger.error({ event: 'cache.get.error', namespace, key, error: error instanceof Error ? error.message : String(error) })
            return null
        }
    }

    async set<T>(namespace: string, key: string, value: T, config?: CacheConfig): Promise<void> {
        try {
            const fullKey = `${PREFIX}${namespace}:${key}`
            const serialized = JSON.stringify(value)
            if (config?.ttl) await redisClient.set(fullKey, serialized, { EX: config.ttl })
            else await redisClient.set(fullKey, serialized)
        } catch (error) {
            logger.error({ event: 'cache.set.error', namespace, key, error: error instanceof Error ? error.message : String(error) })
        }
    }

    async invalidateByKey(key: string): Promise<void> {
        try {
            await redisClient.del(`${PREFIX}${key}`)
        } catch (error) {
            logger.error({ event: 'cache.invalidate.error', key, error: error instanceof Error ? error.message : String(error) })
        }
    }

    async invalidate(namespace: string): Promise<void> {
        try {
            const matched: string[] = []
            for await (const batch of redisClient.scanIterator({ MATCH: `${PREFIX}${namespace}:*` })) {
                matched.push(...batch)
            }
            if (matched.length > 0) await Promise.all(matched.map((k) => redisClient.del(k)))
        } catch (error) {
            logger.error({ event: 'cache.invalidate_namespace.error', namespace, error: error instanceof Error ? error.message : String(error) })
        }
    }

    async clear(): Promise<void> {
        try {
            const matched: string[] = []
            for await (const batch of redisClient.scanIterator({ MATCH: `${PREFIX}*` })) {
                matched.push(...batch)
            }
            if (matched.length > 0) await Promise.all(matched.map((k) => redisClient.del(k)))
        } catch (error) {
            logger.error({ event: 'cache.clear.error', error: error instanceof Error ? error.message : String(error) })
        }
    }
}

export const cacheManager = new CacheManager()
export type { CacheConfig }
