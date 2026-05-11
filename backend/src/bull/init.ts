import { Worker } from 'bullmq'
import { logger } from '../utils/logger'
import { redisConnection } from './connection'

export async function startBullWorker() {
    const worker = new Worker('test-jobs', async (job) => {
        logger.debug({ event: 'bull.job.processing', jobId: job.id, jobName: job.name, data: job.data, timestamp: new Date().toISOString() })
        if (job.data.shouldFail) {
            throw new Error('Simulated failure test')
        }
        return { processed: true, processedAt: new Date().toISOString(), data: job.data }
    },
        {
            connection: redisConnection,
            concurrency: 5
        }
    )

    worker.on('waiting', (jobId) => {
        logger.info({ event: 'bull.job.queued', jobId, message: 'Job queued and waiting to be processed' })
    })

    worker.on('active', (job) => {
        logger.info({ event: 'bull.job.active', jobId: job.id, jobName: job.name, message: 'Job started processing' })
    })

    worker.on('completed', (job) => {
        logger.info({ event: 'bull.job.completed', jobId: job.id })
    })

    worker.on('failed', (job, err) => {
        logger.error({ event: 'bull.job.failed', jobId: job?.id, error: err.message })
    })

    logger.info({ event: 'bull.worker.initialized' })
    return worker
}
