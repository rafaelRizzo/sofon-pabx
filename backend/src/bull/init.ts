import { Worker } from 'bullmq'
import { logger } from '../utils/logger'
import { redisConnection } from './connection'

export const startBullWorker = async () => {
    const worker = new Worker('test-jobs', async (job) => {
        logger.debug({ event: 'bull.job.processing', jobId: job.id, jobName: job.name, data: job.data })
        if (job.data.shouldFail) {
            throw new Error('Simulated failure test')
        }
        return { processed: true, processedAt: new Date().toISOString(), data: job.data }
    }, {
        connection: redisConnection,
        concurrency: 5,
    })

    worker.on('active', (job) => {
        logger.info({ event: 'bull.job.active', jobId: job.id, jobName: job.name, message: 'Job started processing' })
    })

    worker.on('completed', (job) => {
        logger.info({ event: 'bull.job.completed', jobId: job.id, message: 'Job processed successfully'  })
    })

    worker.on('failed', (job, err) => {
        logger.error({ event: 'bull.job.failed', jobId: job?.id, error: err.message, message: 'Job processing failed'  })
    })

    worker.on('error', (err) => {
        logger.error({ event: 'bull.worker.error', error: err.message , message: 'Worker encountered an error'  })
    })

    logger.info({ event: 'bull.worker.initialized' })
    return worker
}
