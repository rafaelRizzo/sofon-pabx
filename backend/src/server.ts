import { app } from './app'
import { validateEnv } from './config/env'
import { connectRedis, disconnectRedis } from './config/redis'
import { logger } from './utils/logger'

async function start() {
    try {
        // Validate environment variables
        const env = validateEnv()
        logger.info({ event: 'env.validated' })

        // Connect to Redis
        await connectRedis()

        await app.listen({ port: env.PORT, host: env.HOST })
        logger.info({
            event: 'server.started',
            host: env.HOST,
            port: env.PORT,
        })
    } catch (err) {
        logger.error({
            event: 'server.start.error',
            message: err instanceof Error ? err.message : String(err),
            error: err,
        })
        process.exit(1)
    }
}

process.on('SIGTERM', async () => {
    logger.info({ event: 'server.shutdown' })
    await disconnectRedis()
    process.exit(0)
})

process.on('SIGINT', async () => {
    logger.info({ event: 'server.interrupt' })
    await disconnectRedis()
    process.exit(0)
})

start()
