import { app } from './app'
import { validateEnv } from './config/env'
import { connectRedis, disconnectRedis } from './config/redis'
import { startAgiServer } from './asterisk/agi-server'
import { startHolidayResyncJob } from './jobs/holiday-resync.job'
import { startAgentAffinityRecalcJob } from './jobs/agent-affinity-recalc.job'
import { logger } from './utils/logger'

async function start() {
    try {
        // Validate environment variables
        const env = validateEnv()
        logger.info({ event: 'env.validated' })

        // Connect to Redis
        await connectRedis()

        startAgiServer(env.AGI_HOST, env.AGI_PORT)
        startHolidayResyncJob()
        startAgentAffinityRecalcJob()

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
