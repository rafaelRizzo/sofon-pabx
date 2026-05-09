import { createClient, type RedisClientType } from 'redis'

type RedisClient = RedisClientType

export const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        reconnectStrategy: (retries) => {
            if (retries > 10) return new Error('Max retries exceeded')
            return Math.min(retries * 1000, 10000)
        }
    }
})
