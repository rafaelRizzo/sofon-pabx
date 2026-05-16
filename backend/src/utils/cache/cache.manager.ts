import { redisClient } from './redis.client'
import { logger } from '../logger'

export interface CacheConfig {
    ttl: number
}

class CacheManager {
    private client = redisClient
    private defaultTTL = 3600 // 1 hora padrão

    constructor() {
        this.client.on('error', (err) => {
            logger.error({ event: 'redis.error', error: (err as Error).message })
        })
    }

    async connect() {
        try {
            await this.client.connect()
            logger.info({ event: 'redis.connected' })
        } catch (error) {
            logger.error({ event: 'redis.connection.failed', error: (error as Error).message })
            throw error
        }
    }

    async disconnect() {
        await this.client.quit()
    }

    private generateKey(namespace: string, identifier: string): string {
        return `${namespace}:${identifier}`
    }

    async get<T>(namespace: string, identifier: string): Promise<T | null> {
        try {
            const key = this.generateKey(namespace, identifier)
            const data = await this.client.get(key)
            return data ? JSON.parse(data) : null
        } catch (error) {
            logger.error({ event: 'cache.get.error', error: (error as Error).message })
            return null
        }
    }

    async set<T>(
        namespace: string,
        identifier: string,
        data: T,
        config?: CacheConfig
    ): Promise<void> {
        try {
            const key = this.generateKey(namespace, identifier)
            const ttl = config?.ttl || this.defaultTTL
            await this.client.setEx(key, ttl, JSON.stringify(data))
        } catch (error) {
            logger.error({ event: 'cache.set.error', error: (error as Error).message })
        }
    }

    async invalidate(namespace: string, pattern?: string): Promise<void> {
        try {
            const searchPattern = pattern
                ? this.generateKey(namespace, pattern)
                : this.generateKey(namespace, '*')

            const keys: string[] = []
            for await (const batch of this.client.scanIterator({ MATCH: searchPattern, COUNT: 100 })) {
                keys.push(...batch)
            }

            if (keys.length > 0) {
                await Promise.all(keys.map(k => this.client.del(k)))
            }
        } catch (error) {
            logger.error({ event: 'cache.invalidate.error', error: (error as Error).message })
        }
    }

    async invalidateByKey(key: string): Promise<void> {
        try {
            await this.client.del(key)
        } catch (error) {
            logger.error({ event: 'cache.invalidate.key.error', error: (error as Error).message })
        }
    }

    async flush(): Promise<void> {
        try {
            const keys: string[] = []
            for await (const batch of this.client.scanIterator({ MATCH: '*', COUNT: 100 })) {
                keys.push(...batch)
            }

            const safeKeys = keys.filter(key => !key.startsWith('jti:') && !key.startsWith('refresh_jti:'))

            if (safeKeys.length > 0) {
                await Promise.all(safeKeys.map(k => this.client.del(k)))
            }
        } catch (error) {
            logger.error({ event: 'cache.flush.error', error: (error as Error).message })
        }
    }
}

export const cacheManager = new CacheManager()
