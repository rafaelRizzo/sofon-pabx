import { createClient } from 'redis'
import { logger } from './logger'

export const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        reconnectStrategy: (retries) => {
            if (retries > 10) return new Error('Max retries exceeded')
            return Math.min(retries * 1000, 10000)
        }
    }
})

redisClient.connect().catch(err => {
    logger.error({ event: 'redis.connection_failed', error: (err as Error).message })
})

redisClient.on('error', err =>
    logger.error({ event: 'redis.error', error: (err as Error).message })
)

redisClient.on('connect', () => logger.info({ event: 'redis.connected' }))
redisClient.on('ready', () => logger.info({ event: 'redis.ready' }))
