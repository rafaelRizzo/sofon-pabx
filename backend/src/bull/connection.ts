import 'dotenv/config'
import IORedis from 'ioredis'
import { logger } from '../utils/logger'

export const redisConnection = new IORedis(process.env.REDIS_URL || 'localhost:6379', {
    maxRetriesPerRequest: null,
})

redisConnection.on('ready', () => logger.info({ event: 'bull.redis.ready' }))
redisConnection.on('error', (err) => logger.error({ event: 'bull.redis.error', error: err.message }))
