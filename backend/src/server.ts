import { app } from './app'
import { validateEnv } from './config/env'
import { connectRedis, disconnectRedis } from './config/redis'
import { startAgiServer } from './asterisk/agi-server'
import { startAmiEvents, stopAmiEvents } from './asterisk/ami-events'
import { ensureStaticAsteriskConfig } from './asterisk/ensure-static-config'
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

        // Autocura config estática do Asterisk (sofon-managed.conf/features.conf) a cada boot —
        // deploy vira só "git pull + rebuild", sem precisar chamar resyncDialplan manualmente nem
        // reinstalar o Asterisk pra propagar ajustes como transferdigittimeout. Nunca lança.
        await ensureStaticAsteriskConfig()

        startAgiServer(env.AGI_HOST, env.AGI_PORT)
        startAmiEvents()
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
    await stopAmiEvents()
    await disconnectRedis()
    process.exit(0)
})

process.on('SIGINT', async () => {
    logger.info({ event: 'server.interrupt' })
    await stopAmiEvents()
    await disconnectRedis()
    process.exit(0)
})

start()
