import { db } from '../../db/config/db'
import { eq, and } from 'drizzle-orm'
import { queues } from '../../db/schemas/queues'
import { companies } from '../../db/schemas/companies'
import { AppError } from '../../utils/handlers/app.error'
import { QueuesCache } from './cache/queues.cache'

import type {
    CreateQueueInput,
    UpdateQueueInput,
} from './schemas/queue.schema'

const queueSelect = {
    id: queues.id,
    company_id: queues.company_id,
    name: queues.name,
    number: queues.number,
    account_code: queues.account_code,
    strategy: queues.strategy,
    timeout: queues.timeout,
    maxlen: queues.maxlen,
    musiconhold: queues.musiconhold,
    announce: queues.announce,
    joinempty: queues.joinempty,
    leavewhenempty: queues.leavewhenempty,
    weight: queues.weight,
    autopause: queues.autopause,
    announcefrequency: queues.announcefrequency,
    announceholdtime: queues.announceholdtime,
    context: queues.context,
    metadata: queues.metadata,
    status: queues.status,
    created_at: queues.created_at,
    updated_at: queues.updated_at,
}

export const getAllQueues = async () => {
    const cached = await QueuesCache.getAllQueues()
    if (cached) return cached

    const result = await db.select(queueSelect).from(queues)
    await QueuesCache.setAllQueues(result)

    return result
}

export const getQueueById = async (id: string) => {
    const cached = await QueuesCache.getQueue(id)
    if (cached) return cached

    const [queue] = await db
        .select(queueSelect)
        .from(queues)
        .where(eq(queues.id, id))

    if (queue) {
        await QueuesCache.setQueue(id, queue)
    }

    return queue ?? null
}

export const getCompanyQueues = async (companyId: string) => {
    const cached = await QueuesCache.getCompanyQueues(companyId)
    if (cached) return cached

    const result = await db
        .select(queueSelect)
        .from(queues)
        .where(eq(queues.company_id, companyId))

    await QueuesCache.setCompanyQueues(companyId, result)

    return result
}

export const createQueue = async (data: CreateQueueInput) => {
    const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, data.company_id))

    if (!company) {
        throw new AppError('Company not found', 404)
    }

    const [existingName] = await db
        .select()
        .from(queues)
        .where(and(
            eq(queues.company_id, data.company_id),
            eq(queues.name, data.name)
        ))

    if (existingName) {
        throw new AppError('Queue with this name already exists in this company', 409)
    }

    const [existingNumber] = await db
        .select()
        .from(queues)
        .where(and(
            eq(queues.company_id, data.company_id),
            eq(queues.number, data.number)
        ))

    if (existingNumber) {
        throw new AppError('Queue with this number already exists in this company', 409)
    }

    const [existingAccountCode] = await db
        .select()
        .from(queues)
        .where(eq(queues.account_code, data.account_code))

    if (existingAccountCode) {
        throw new AppError('Account code already in use', 409)
    }

    const [queue] = await db
        .insert(queues)
        .values({
            company_id: data.company_id,
            name: data.name,
            number: data.number,
            account_code: data.account_code,
            strategy: data.strategy,
            timeout: data.timeout,
            maxlen: data.maxlen,
            musiconhold: data.musiconhold,
            announce: data.announce,
            joinempty: data.joinempty,
            leavewhenempty: data.leavewhenempty,
            weight: data.weight,
            autopause: data.autopause,
            announcefrequency: data.announcefrequency,
            announceholdtime: data.announceholdtime,
            context: data.context,
            metadata: data.metadata,
        })
        .returning(queueSelect)

    await QueuesCache.invalidateCompanyQueues(data.company_id)
    await QueuesCache.invalidateAllQueues()

    return queue
}

export const updateQueue = async (id: string, data: UpdateQueueInput) => {
    const [existingQueue] = await db
        .select()
        .from(queues)
        .where(eq(queues.id, id))

    if (!existingQueue) {
        throw new AppError('Queue not found', 404)
    }

    const updateData: any = {}

    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
            updateData[key] = value
        }
    })

    const [queue] = await db
        .update(queues)
        .set(updateData)
        .where(eq(queues.id, id))
        .returning(queueSelect)

    await QueuesCache.invalidateQueue(id)
    await QueuesCache.invalidateCompanyQueues(existingQueue.company_id)
    await QueuesCache.invalidateAllQueues()

    return queue ?? null
}

export const deleteQueue = async (id: string) => {
    const [queue] = await db
        .delete(queues)
        .where(eq(queues.id, id))
        .returning(queueSelect)

    if (queue) {
        await QueuesCache.invalidateQueue(id)
        await QueuesCache.invalidateCompanyQueues(queue.company_id)
        await QueuesCache.invalidateAllQueues()
    }

    return queue ?? null
}
