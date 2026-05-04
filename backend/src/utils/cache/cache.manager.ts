import { createClient, type RedisClientType } from 'redis'

type RedisClient = RedisClientType

export interface CacheConfig {
    ttl: number // em segundos
}

class CacheManager {
    private client: RedisClient
    private defaultTTL = 3600 // 1 hora padrão

    constructor() {
        this.client = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        })

        this.client.on('error', (err) => {
            console.error('Redis error:', err)
        })
    }

    async connect() {
        try {
            await this.client.connect()
            console.log('✓ Redis connected')
        } catch (error) {
            console.error('Failed to connect to Redis:', error)
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
            console.error('Cache get error:', error)
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
            console.error('Cache set error:', error)
        }
    }

    async invalidate(namespace: string, pattern?: string): Promise<void> {
        try {
            const searchPattern = pattern
                ? this.generateKey(namespace, pattern)
                : this.generateKey(namespace, '*')

            const keys = await this.client.keys(searchPattern)

            if (keys.length > 0) {
                await this.client.del(keys)
            }
        } catch (error) {
            console.error('Cache invalidate error:', error)
        }
    }

    async invalidateByKey(key: string): Promise<void> {
        try {
            await this.client.del(key)
        } catch (error) {
            console.error('Cache invalidate by key error:', error)
        }
    }

    async flush(): Promise<void> {
        try {
            await this.client.flushDb()
        } catch (error) {
            console.error('Cache flush error:', error)
        }
    }
}

export const cacheManager = new CacheManager()
