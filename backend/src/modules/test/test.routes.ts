import type { FastifyInstance } from 'fastify'
import { testQueue } from '../../bull/queues'

const DELAY_MS = 5000

interface ListJobsQuery {
    page?: string
    limit?: string
    state?: string
}

export async function testRoutes(app: FastifyInstance) {
    app.post<{ Body: Record<string, unknown> }>('/test/queue', async (req, reply) => {
        try {
            const job = await testQueue.add('test-job', req.body || { test: true }, { delay: DELAY_MS })
            return reply.status(202).send({
                success: true,
                job_id: job.id,
                message: 'Job queued successfully'
            })
        } catch (error) {
            app.log.error({ event: 'test.queue.error', error: (error as Error).message })
            return reply.status(500).send({
                success: false,
                message: 'Failed to queue job'
            })
        }
    })

    app.get<{ Querystring: ListJobsQuery }>('/test/queue', async (req, reply) => {
        try {
            const page = Math.max(1, Number(req.query.page) || 1)
            const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10))
            const filterState = req.query.state as any

            const counts = await testQueue.getJobCounts()
            const skip = (page - 1) * limit

            let allJobs: any[] = []
            const allStates = ['waiting', 'delayed', 'active', 'completed', 'failed', 'paused', 'prioritized', 'waiting-children']
            const states = filterState ? [filterState] : allStates

            for (const state of states) {
                try {
                    const stateJobs = await testQueue.getJobs([state], 0, -1)
                    allJobs.push(...stateJobs)
                } catch (e) {
                    // ignore state fetch errors
                }
            }

            allJobs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
            const paginatedJobs = allJobs.slice(skip, skip + limit)

            const jobsData = await Promise.all(
                paginatedJobs.map(async (job) => {
                    const jobState = await job.getState()
                    return {
                        job_id: job.id,
                        name: job.name,
                        state: jobState,
                        progress: job.progress,
                        result: job.returnvalue,
                        data: job.data,
                        created_at: new Date(job.timestamp || 0).toISOString(),
                        finished_at: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
                        failed_reason: jobState === 'failed' ? job.failedReason : null,
                        attempts: job.attemptsMade,
                        max_attempts: job.opts?.attempts ?? 0
                    }
                })
            )

            const total = filterState ? (counts[filterState] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0)

            return reply.status(200).send({
                success: true,
                data: jobsData,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                },
                counts
            })
        } catch (error) {
            app.log.error({ event: 'test.queue.list.error', error: (error as Error).message })
            return reply.status(500).send({
                success: false,
                message: 'Failed to fetch jobs'
            })
        }
    })

    app.get<{ Params: { job_id: string } }>('/test/queue/:job_id', async (req, reply) => {
        try {
            const { job_id } = req.params
            const job = await testQueue.getJob(job_id)

            if (!job) {
                return reply.status(404).send({
                    success: false,
                    message: 'Job not found'
                })
            }

            const state = await job.getState()
            const progress = job.progress
            const result = job.returnvalue

            return reply.status(200).send({
                success: true,
                job_id: job.id,
                state,
                progress,
                result,
                data: job.data
            })
        } catch (error) {
            app.log.error({ event: 'test.queue.get.error', error: (error as Error).message })
            return reply.status(500).send({
                success: false,
                message: 'Failed to fetch job'
            })
        }
    })
}
