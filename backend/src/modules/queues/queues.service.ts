import { prisma } from '../../lib/prisma'
import { QueuesCache } from './cache/queues.cache'
import type { CreateQueueInput, UpdateQueueInput, AddMemberInput, UpdateMemberInput } from './schemas/queue.schema'
import { AsteriskQueueRepository } from '../../asterisk/queue.repository'
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
    joinEmpty: true,
    leaveWhenEmpty: true,
    weight: true,
    metadata: true,
    createdAt: true,
    updatedAt: true,
    company: { select: { asteriskId: true } },
    _count: { select: { members: true } },
} as const

const memberSelect = {
    id: true,
    queueId: true,
    extensionId: true,
    penalty: true,
    paused: true,
    createdAt: true,
    updatedAt: true,
    extension: {
        select: { id: true, name: true, number: true, alias: true, type: true, companyId: true },
    },
} as const

const toAsteriskQueueName = (companyAsteriskId: string, queueName: string) =>
    `${companyAsteriskId}-${queueName}`

const toAsteriskInterface = (type: string, number: string) =>
    `${type.toUpperCase()}/${number}`

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
    const company = await prisma.company.findUnique({ where: { id: companyId } })
    if (!company) throw new AppError('Company not found', 404)

    const cached = await QueuesCache.getByCompany(companyId)
    if (cached) return cached

    const queues = await prisma.queue.findMany({ where: { companyId }, select: queueSelect })
    await QueuesCache.setByCompany(companyId, queues)
    return queues
}

export const getQueueById = async (id: string) => {
    const cached = await QueuesCache.getQueue(id)
    if (cached) return cached

    const queue = await prisma.queue.findUnique({ where: { id }, select: queueSelect })
    if (!queue) throw new AppError('Queue not found', 404)

    await QueuesCache.setQueue(id, queue)
    return queue
}

export const getQueueMembers = async (queueId: string) => {
    const queue = await prisma.queue.findUnique({ where: { id: queueId } })
    if (!queue) throw new AppError('Queue not found', 404)

    const cached = await QueuesCache.getMembers(queueId)
    if (cached) return cached

    const members = await prisma.queueMember.findMany({ where: { queueId }, select: memberSelect })
    await QueuesCache.setMembers(queueId, members)
    return members
}

export const createQueue = async (data: CreateQueueInput) => {
    const company = await prisma.company.findUnique({ where: { id: data.companyId } })
    if (!company) throw new AppError('Company not found', 404)

    const existing = await prisma.queue.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Queue already exists for this company', 409)

    const asteriskName = toAsteriskQueueName(company.asteriskId, data.name)

    const queue = await prisma.$transaction(async (tx) => {
        const q = await tx.queue.create({ data, select: queueSelect })
        await AsteriskQueueRepository.createQueue(tx, asteriskName, data)
        return q
    })

    await QueuesCache.invalidateByCompany(data.companyId)
    await QueuesCache.invalidateAll()
    return queue
}

export const addMember = async (queueId: string, data: AddMemberInput) => {
    const queue = await prisma.queue.findUnique({
        where: { id: queueId },
        include: { company: { select: { asteriskId: true } } },
    })
    if (!queue) throw new AppError('Queue not found', 404)

    const extension = await prisma.extension.findUnique({
        where: { id: data.extensionId },
        select: { id: true, name: true, number: true, type: true, companyId: true },
    })
    if (!extension) throw new AppError('Extension not found', 404)
    if (extension.companyId !== queue.companyId)
        throw new AppError('Extension does not belong to the same company as the queue', 403)

    const alreadyMember = await prisma.queueMember.findUnique({
        where: { queueId_extensionId: { queueId, extensionId: data.extensionId } },
    })
    if (alreadyMember) throw new AppError('Extension is already a member of this queue', 409)

    const asteriskName = toAsteriskQueueName(queue.company.asteriskId, queue.name)
    const iface = toAsteriskInterface(extension.type, extension.number)

    const member = await prisma.$transaction(async (tx) => {
        const m = await tx.queueMember.create({ data: { queueId, ...data }, select: memberSelect })
        await AsteriskQueueRepository.addMember(tx, asteriskName, iface, {
            memberName: extension.name,
            penalty: data.penalty ?? 0,
            paused: data.paused ?? false,
        })
        return m
    })

    await QueuesCache.invalidateMembers(queueId)
    await QueuesCache.invalidateQueue(queueId)
    await QueuesCache.invalidateByCompany(queue.companyId)
    await QueuesCache.invalidateAll()
    return member
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

    if (data.number !== undefined && data.number !== null && data.number !== existing.number) {
        const duplicate = await prisma.queue.findFirst({
            where: { number: data.number, companyId: existing.companyId, NOT: { id } },
        })
        if (duplicate) throw new AppError('Queue number already in use for this company', 409)
    }

    const asteriskUpdate: Record<string, any> = {}
    if (data.strategy !== undefined) asteriskUpdate.strategy = data.strategy
    if (data.musicOnHold !== undefined) asteriskUpdate.musiconhold = data.musicOnHold
    if (data.timeout !== undefined) asteriskUpdate.timeout = data.timeout
    if (data.retry !== undefined) asteriskUpdate.retry = data.retry
    if (data.maxLen !== undefined) asteriskUpdate.maxlen = data.maxLen
    if (data.wrapupTime !== undefined) asteriskUpdate.wrapuptime = data.wrapupTime
    if (data.announce !== undefined) asteriskUpdate.announce = data.announce
    if (data.announceFrequency !== undefined) asteriskUpdate.announceFreq = data.announceFrequency
    if (data.joinEmpty !== undefined) asteriskUpdate.joinempty = data.joinEmpty ? 'yes' : 'no'
    if (data.leaveWhenEmpty !== undefined) asteriskUpdate.leavewhenempty = data.leaveWhenEmpty ? 'yes' : 'no'
    if (data.weight !== undefined) asteriskUpdate.weight = data.weight

    const { name, number, ...appRest } = data
    const appUpdate: Record<string, any> = { ...appRest }
    if (name !== undefined) appUpdate.name = name
    if (number !== undefined) appUpdate.number = number

    const queue = await prisma.$transaction(async (tx) => {
        if (nameChanged) await AsteriskQueueRepository.renameQueue(tx, oldAsteriskName, newAsteriskName)
        await AsteriskQueueRepository.updateQueue(tx, newAsteriskName, asteriskUpdate)
        return tx.queue.update({ where: { id }, data: appUpdate, select: queueSelect })
    })

    await QueuesCache.invalidateQueue(id)
    await QueuesCache.invalidateByCompany(existing.companyId)
    await QueuesCache.invalidateAll()
    return queue
}

export const updateMember = async (queueId: string, memberId: string, data: UpdateMemberInput) => {
    const member = await prisma.queueMember.findUnique({
        where: { id: memberId },
        include: {
            queue: { include: { company: { select: { asteriskId: true } } } },
            extension: { select: { number: true, type: true } },
        },
    })
    if (!member || member.queueId !== queueId) throw new AppError('Member not found', 404)

    const asteriskName = toAsteriskQueueName(member.queue.company.asteriskId, member.queue.name)
    const iface = toAsteriskInterface(member.extension.type, member.extension.number)

    const updated = await prisma.$transaction(async (tx) => {
        const m = await tx.queueMember.update({ where: { id: memberId }, data, select: memberSelect })
        await AsteriskQueueRepository.updateMember(tx, asteriskName, iface, data)
        return m
    })

    await QueuesCache.invalidateMembers(queueId)
    await QueuesCache.invalidateQueue(queueId)
    return updated
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

    await QueuesCache.invalidateQueue(id)
    await QueuesCache.invalidateMembers(id)
    await QueuesCache.invalidateByCompany(existing.companyId)
    await QueuesCache.invalidateAll()
}

export const removeMember = async (queueId: string, memberId: string) => {
    const member = await prisma.queueMember.findUnique({
        where: { id: memberId },
        include: {
            queue: { include: { company: { select: { asteriskId: true } } } },
            extension: { select: { number: true, type: true } },
        },
    })
    if (!member || member.queueId !== queueId) throw new AppError('Member not found', 404)

    const asteriskName = toAsteriskQueueName(member.queue.company.asteriskId, member.queue.name)
    const iface = toAsteriskInterface(member.extension.type, member.extension.number)

    await prisma.$transaction(async (tx) => {
        await tx.queueMember.delete({ where: { id: memberId } })
        await AsteriskQueueRepository.removeMember(tx, asteriskName, iface)
    })

    await QueuesCache.invalidateMembers(queueId)
    await QueuesCache.invalidateQueue(queueId)
    await QueuesCache.invalidateByCompany(member.queue.companyId)
    await QueuesCache.invalidateAll()
}
