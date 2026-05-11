import { Queue } from 'bullmq'
import { redisConnection } from './connection'

export const testQueue = new Queue('test-jobs', { connection: redisConnection })