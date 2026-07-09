import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { QueuesCache } from './cache/queues.cache'
import { QueueMembersCache } from '../queue-members/cache/queue-members.cache'
import type { CreateQueueInput, UpdateQueueInput } from './schemas/queue.schema'
import { AsteriskQueueRepository, toAsteriskQueueName } from '../../asterisk/queue.repository'
import { validateRouteDestination } from '../../schemas/route-destination.validate'
import { AppError } from '../../utils/errors/app.error'

const queueSelect = {
    id: true,
    name: true,
    number: true,
    companyId: true,
    strategy: true,
    musicOnHold: true,
    timeout: true,
    retry: true,
    maxLen: true,
    wrapupTime: true,
    announce: true,
    announceFrequency: true,
    announcePosition: true,
    periodicAnnounce: true,
    periodicAnnounceFrequency: true,
    joinEmpty: true,
    leaveWhenEmpty: true,
    weight: true,
    metadata: true,
    postQueueDestination: true,
    createdAt: true,
    updatedAt: true,
    company: { select: { asteriskId: true } },
    _count: { select: { members: true } },
} as const

export const getAllQueues = async (companyIds?: string[]) => {
    if (companyIds && companyIds.length === 0) return []

    if (!companyIds) {
        const cached = await QueuesCache.getAll()
        if (cached) return cached
    }

    const queues = await prisma.queue.findMany({
        where: companyIds ? { companyId: { in: companyIds } } : undefined,
        select: queueSelect,
    })

    if (!companyIds) await QueuesCache.setAll(queues)
    return queues
}

export const getQueuesByCompany = async (companyId: string) => {
    const cached = await QueuesCache.getByCompany(companyId)
    if (cached) return cached

    await getCompanyById(companyId)

    const queues = await prisma.queue.findMany({ where: { companyId }, select: queueSelect })
    await QueuesCache.setByCompany(companyId, queues)
    return queues
}

const _queueByIdQuery = () => prisma.queue.findUnique({ where: { id: '' }, select: queueSelect })
export type QueueDto = NonNullable<Awaited<ReturnType<typeof _queueByIdQuery>>>

export const getQueueById = async (id: string): Promise<QueueDto> => {
    const cached = await QueuesCache.getQueue(id)
    if (cached) return cached as QueueDto

    const queue = await prisma.queue.findUnique({ where: { id }, select: queueSelect })
    if (!queue) throw new AppError('Queue not found', 404)

    await QueuesCache.setQueue(id, queue)
    return queue
}

export const createQueue = async (data: CreateQueueInput) => {
    const company = await getCompanyById(data.companyId)

    const existing = await prisma.queue.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Queue already exists for this company', 409)

    const duplicateNumber = await prisma.queue.findUnique({
        where: { number_companyId: { number: data.number, companyId: data.companyId } },
    })
    if (duplicateNumber) throw new AppError('Queue number already in use for this company', 409)

    await validateRouteDestination(data.postQueueDestination ?? null, data.companyId, 'postQueueDestination')

    const asteriskName = toAsteriskQueueName(company.asteriskId, data.name)

    const queue = await prisma.$transaction(async (tx) => {
        const q = await tx.queue.create({
            data: { ...data, postQueueDestination: data.postQueueDestination ?? undefined },
            select: queueSelect,
        })
        await AsteriskQueueRepository.createQueue(tx, asteriskName, data)
        return q
    })

    try {
        await AsteriskQueueRepository.regenerate(data.companyId)
    } finally {
        await QueuesCache.invalidateByCompany(data.companyId)
        await QueuesCache.invalidateAll()
    }
    return queue
}

export const updateQueue = async (id: string, data: UpdateQueueInput) => {
    const existing = await prisma.queue.findUnique({
        where: { id },
        include: { company: { select: { asteriskId: true } } },
    })
    if (!existing) throw new AppError('Queue not found', 404)

    const nameChanged = data.name !== undefined && data.name !== existing.name
    const oldAsteriskName = toAsteriskQueueName(existing.company.asteriskId, existing.name)
    const newAsteriskName = nameChanged
        ? toAsteriskQueueName(existing.company.asteriskId, data.name!)
        : oldAsteriskName

    if (nameChanged) {
        const duplicate = await prisma.queue.findUnique({
            where: { name_companyId: { name: data.name!, companyId: existing.companyId } },
        })
        if (duplicate) throw new AppError('Queue name already in use for this company', 409)
    }

    if (data.number !== undefined && data.number !== existing.number) {
        const duplicate = await prisma.queue.findFirst({
            where: { number: data.number, companyId: existing.companyId, NOT: { id } },
        })
        if (duplicate) throw new AppError('Queue number already in use for this company', 409)
    }

    if (data.postQueueDestination !== undefined)
        await validateRouteDestination(data.postQueueDestination, existing.companyId, 'postQueueDestination')

    const asteriskUpdate: Record<string, any> = {}
    if (data.strategy !== undefined) asteriskUpdate.strategy = data.strategy
    if (data.musicOnHold !== undefined) asteriskUpdate.musiconhold = data.musicOnHold
    if (data.timeout !== undefined) asteriskUpdate.timeout = data.timeout
    if (data.retry !== undefined) asteriskUpdate.retry = data.retry
    if (data.maxLen !== undefined) asteriskUpdate.maxlen = data.maxLen
    if (data.wrapupTime !== undefined) asteriskUpdate.wrapuptime = data.wrapupTime
    if (data.announce !== undefined) asteriskUpdate.announce = data.announce
    if (data.announceFrequency !== undefined) asteriskUpdate.announceFreq = data.announceFrequency
    if (data.announcePosition !== undefined) asteriskUpdate.announcePosition = data.announcePosition ? 'yes' : 'no'
    if (data.periodicAnnounce !== undefined) asteriskUpdate.periodicAnnounce = data.periodicAnnounce
    if (data.periodicAnnounceFrequency !== undefined)
        asteriskUpdate.periodicAnnounceFreq = data.periodicAnnounceFrequency
    if (data.joinEmpty !== undefined) asteriskUpdate.joinempty = data.joinEmpty ? 'yes' : 'no'
    if (data.leaveWhenEmpty !== undefined) asteriskUpdate.leavewhenempty = data.leaveWhenEmpty ? 'yes' : 'no'
    if (data.weight !== undefined) asteriskUpdate.weight = data.weight

    const { name, number, ...appRest } = data
    const appUpdate: Record<string, any> = { ...appRest }
    if (name !== undefined) appUpdate.name = name
    if (number !== undefined) appUpdate.number = number

    const newNumber = data.number === undefined ? existing.number : data.number
    const numberChanged = newNumber !== existing.number
    const destChanged = data.postQueueDestination !== undefined
    const needsResync = numberChanged || nameChanged || destChanged

    const queue = await prisma.$transaction(async (tx) => {
        if (nameChanged) await AsteriskQueueRepository.renameQueue(tx, oldAsteriskName, newAsteriskName)
        await AsteriskQueueRepository.updateQueue(tx, newAsteriskName, asteriskUpdate)

        return tx.queue.update({ where: { id }, data: appUpdate, select: queueSelect })
    })

    try {
        if (needsResync) await AsteriskQueueRepository.regenerate(existing.companyId)
    } finally {
        await QueuesCache.invalidateQueue(id)
        await QueuesCache.invalidateByCompany(existing.companyId)
        await QueuesCache.invalidateAll()
    }
    return queue
}

export const deleteQueue = async (id: string) => {
    const existing = await prisma.queue.findUnique({
        where: { id },
        include: { company: { select: { asteriskId: true } } },
    })
    if (!existing) throw new AppError('Queue not found', 404)

    const asteriskName = toAsteriskQueueName(existing.company.asteriskId, existing.name)

    await prisma.$transaction(async (tx) => {
        await AsteriskQueueRepository.deleteQueue(tx, asteriskName)
        await tx.queue.delete({ where: { id } })
    })

    try {
        await AsteriskQueueRepository.regenerate(existing.companyId)
    } finally {
        await QueuesCache.invalidateQueue(id)
        await QueueMembersCache.invalidateMembers(id)
        await QueuesCache.invalidateByCompany(existing.companyId)
        await QueuesCache.invalidateAll()
    }
}
