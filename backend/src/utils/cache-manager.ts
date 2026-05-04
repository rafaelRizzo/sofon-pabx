import { redisClient } from './redis'
import { logger } from './logger'

export function createCacheManager(namespace: string, ttls = { list: 300, item: 600 }) {
    const get = async <T>(key: string, label: string): Promise<T | null> => {
        try {
            const raw = await redisClient.get(key)
            if (raw) {
                logger.info({ event: `${namespace}.cache.hit`, key: label })
                return JSON.parse(raw) as T
            }
            logger.info({ event: `${namespace}.cache.miss`, key: label })
            return null
        } catch (err: any) {
            logger.error({ event: `${namespace}.cache.error`, key: label, error: err.message })
            return null
        }
    }

    const set = async (key: string, data: unknown, ttl = ttls.list): Promise<void> => {
        try {
            await redisClient.setEx(key, ttl, JSON.stringify(data))
        } catch (err: any) {
            logger.error({ event: `${namespace}.cache.set_failed`, error: err.message })
        }
    }

    const del = async (...keys: (string | undefined)[]): Promise<void> => {
        try {
            const valid = keys.filter((k): k is string => !!k)
            if (valid.length > 0) await redisClient.del(valid)
        } catch (err: any) {
            logger.error({ event: `${namespace}.cache.del_failed`, error: err.message })
        }
    }

    const scanAndDelete = async (pattern: string): Promise<void> => {
        try {
            let cursor = '0'
            do {
                const reply = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 })
                cursor = String(reply.cursor)
                if (reply.keys.length > 0) await redisClient.del(reply.keys)
            } while (cursor !== '0')
        } catch (err: any) {
            logger.error({ event: `${namespace}.cache.scan_delete_failed`, error: err.message })
        }
    }

    return { get, set, del, scanAndDelete, ttls }
}
