import { app } from './app'
import { validateEnv } from './config/env'
import { connectRedis, disconnectRedis } from './config/redis'
import { startAgiServer } from './asterisk/agi-server'
import { startAmiEvents, stopAmiEvents } from './asterisk/ami-events'
import { ensureStaticAsteriskConfig } from './asterisk/ensure-static-config'
import { runCacheMigrations } from './lib/cache-migrations'
import { startHolidayResyncJob } from './jobs/holiday-resync.job'
import { startAgentAffinityRecalcJob } from './jobs/agent-affinity-recalc.job'
import { logger } from './utils/logger'

async function start() {
    try {
        // Validate environment variables
        const env = validateEnv()
        logger.info({ event: 'env.validated', role: env.PROCESS_ROLE })

        const runsWeb = env.PROCESS_ROLE === 'web' || env.PROCESS_ROLE === 'all'
        const runsWorker = env.PROCESS_ROLE === 'worker' || env.PROCESS_ROLE === 'all'

        // Redis: JTI + cache de entidades (lado web) e cache de presence AMI (lado worker,
        // ver ami-events.ts/writePresence) - precisa estar conectado nos dois papéis, senão
        // toda escrita de presence no worker falha silenciosa com "The client is closed"
        // (engolida por ami.events.handler.failed) e o status ao vivo nunca chega no Redis
        await connectRedis()

        if (runsWorker) {
            // Autocura config estática do Asterisk (sofon-managed.conf/features.conf) a cada boot -
            // deploy vira só "git pull + rebuild", sem precisar chamar resyncDialplan manualmente nem
            // reinstalar o Asterisk pra propagar ajustes como transferdigittimeout. Nunca lança.
            await ensureStaticAsteriskConfig()

            // Correções de cache que só precisam rodar uma vez por ambiente (marca no Redis que
            // já rodou) - ver src/lib/cache-migrations.ts
            await runCacheMigrations()

            // AGI/AMI/jobs são singleton por natureza (porta fixa, listener de evento único, jobs
            // idempotentes mas redundantes se duplicados) - nunca rodam em réplica 'web'
            startAgiServer(env.AGI_LISTEN_HOST, env.AGI_PORT)
            startAmiEvents()
            startHolidayResyncJob()
            startAgentAffinityRecalcJob()
        }

        if (runsWeb) {
            await app.listen({ port: env.PORT, host: env.HOST })
            logger.info({
                event: 'server.started',
                host: env.HOST,
                port: env.PORT,
            })
        } else {
            logger.info({ event: 'worker.started' })
        }
    } catch (err) {
        logger.error({
            event: 'server.start.error',
            message: err instanceof Error ? err.message : String(err),
            error: err,
        })
        process.exit(1)
    }
}

async function shutdown() {
    const env = validateEnv()
    if (env.PROCESS_ROLE === 'worker' || env.PROCESS_ROLE === 'all') {
        await stopAmiEvents()
    }
    await disconnectRedis()
}

process.on('SIGTERM', async () => {
    logger.info({ event: 'server.shutdown' })
    await shutdown()
    process.exit(0)
})

process.on('SIGINT', async () => {
    logger.info({ event: 'server.interrupt' })
    await shutdown()
    process.exit(0)
})

start()
