import { createClient } from 'redis'
import { logger } from '../utils/logger'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

export const redisClient = createClient({
    url: redisUrl,
})

redisClient.on('error', (err) => {
    logger.error({
        event: 'redis.error',
        message: err.message,
    })
})

redisClient.on('connect', () => {
    logger.info({
        event: 'redis.connected',
    })
})

export const connectRedis = async () => {
    if (redisClient.isOpen) return
    try {
        await redisClient.connect()
        logger.info({ event: 'redis.connection.success' })
    } catch (error) {
        logger.error({
            event: 'redis.connection.error',
            message: error instanceof Error ? error.message : String(error),
        })
        throw error
    }
}

export const disconnectRedis = async () => {
    try {
        await redisClient.quit()
        logger.info({ event: 'redis.disconnected' })
    } catch (error) {
        logger.error({
            event: 'redis.disconnect.error',
            message: error instanceof Error ? error.message : String(error),
        })
    }
}
