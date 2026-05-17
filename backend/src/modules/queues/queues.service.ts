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

const getCompanyOwner = async (company_id: bigint) => {
    const [company] = await db
        .select({ owner_id: companies.owner_id })
        .from(companies)
        .where(eq(companies.id, company_id))
    return company?.owner_id || null
}

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
    obs: queues.obs,
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

export const getQueueById = async (id: bigint) => {
    const cached = await QueuesCache.getQueue(id.toString())
    if (cached) return cached

    const [queue] = await db
        .select(queueSelect)
        .from(queues)
        .where(eq(queues.id, id))

    if (queue) {
        await QueuesCache.setQueue(id.toString(), queue)
    }

    return queue ?? null
}

export const getCompanyQueues = async (companyId: bigint) => {
    const cached = await QueuesCache.getCompanyQueues(companyId.toString())
    if (cached) return cached

    const result = await db
        .select(queueSelect)
        .from(queues)
        .where(eq(queues.company_id, companyId))

    await QueuesCache.setCompanyQueues(companyId.toString(), result)

    return result
}

export const createQueue = async (data: CreateQueueInput, isAdmin = false) => {
    const [company] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.id, data.company_id))

    if (!company) {
        throw new AppError('Company not found', 404)
    }

    const [existingName] = await db
        .select({ id: queues.id })
        .from(queues)
        .where(and(
            eq(queues.company_id, data.company_id),
            eq(queues.name, data.name)
        ))

    if (existingName) {
        throw new AppError('Queue with this name already exists in this company', 409)
    }

    const [existingNumber] = await db
        .select({ id: queues.id })
        .from(queues)
        .where(and(
            eq(queues.company_id, data.company_id),
            eq(queues.number, data.number)
        ))

    if (existingNumber) {
        throw new AppError('Queue with this number already exists in this company', 409)
    }

    const [existingAccountCode] = await db
        .select({ id: queues.id })
        .from(queues)
        .where(eq(queues.account_code, data.account_code))

    if (existingAccountCode) {
        throw new AppError('Account code already in use', 409)
    }

    const [queue] = await db
        .insert(queues)
        .values(data)
        .returning(queueSelect)

    if (queue) {
        await QueuesCache.invalidateCompanyQueues(data.company_id.toString())
        if (isAdmin) await QueuesCache.invalidateAllQueues()
    }

    return queue
}

export const updateQueue = async (id: bigint, data: UpdateQueueInput, isAdmin = false) => {
    const [existingQueue] = await db
        .select({ company_id: queues.company_id })
        .from(queues)
        .where(eq(queues.id, id))

    if (!existingQueue) {
        throw new AppError('Queue not found', 404)
    }

    const updateData: Record<string, any> = {}
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

    if (queue) {
        await QueuesCache.invalidateQueue(id.toString())
        await QueuesCache.invalidateCompanyQueues(queue.company_id.toString())
        if (isAdmin) await QueuesCache.invalidateAllQueues()
    }

    return queue ?? null
}

export const deleteQueue = async (id: bigint, isAdmin = false) => {
    const queue = await getQueueById(id)
    if (!queue) return null

    const [deletedQueue] = await db
        .delete(queues)
        .where(eq(queues.id, id))
        .returning(queueSelect)

    if (deletedQueue) {
        await QueuesCache.invalidateQueue(id.toString())
        await QueuesCache.invalidateCompanyQueues(queue.company_id.toString())
        if (isAdmin) await QueuesCache.invalidateAllQueues()
    }

    return deletedQueue ?? null
}
