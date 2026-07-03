import { prisma } from '../../lib/prisma'
import { QueuesCache } from '../queues/cache/queues.cache'
import { QueueMembersCache } from './cache/queue-members.cache'
import { getQueueById, type QueueDto } from '../queues/queues.service'
import { AsteriskQueueRepository } from '../../asterisk/queue.repository'
import type { AddMemberInput, UpdateMemberInput } from './schemas/queue-member.schema'
import { AppError } from '../../utils/errors/app.error'

const memberSelect = {
    id: true,
    queueId: true,
    extensionId: true,
    penalty: true,
    paused: true,
    pauseReason: true,
    createdAt: true,
    updatedAt: true,
    extension: {
        select: { id: true, name: true, number: true, alias: true, type: true, companyId: true },
    },
} as const

const toAsteriskQueueName = (asteriskId: string, queueName: string) => `${asteriskId}-${queueName}`
const toAsteriskInterface = (type: string, number: string) => `${type.toUpperCase()}/${number}`

export const getQueueMembers = async (queueId: string) => {
    const cached = await QueueMembersCache.getMembers(queueId)
    if (cached) return cached

    const queue = await prisma.queue.findUnique({ where: { id: queueId } })
    if (!queue) throw new AppError('Queue not found', 404)

    const members = await prisma.queueMember.findMany({ where: { queueId }, select: memberSelect })
    await QueueMembersCache.setMembers(queueId, members)
    return members
}

export const addMember = async (queueId: string, data: AddMemberInput) => {
    const queue = await getQueueById(queueId)

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

    await QueueMembersCache.invalidateMembers(queueId)
    await QueuesCache.invalidateQueue(queueId)
    await QueuesCache.invalidateByCompany(queue.companyId)
    await QueuesCache.invalidateAll()
    return member
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

    await QueueMembersCache.invalidateMembers(queueId)
    await QueuesCache.invalidateQueue(queueId)
    return updated
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

    await QueueMembersCache.invalidateMembers(queueId)
    await QueuesCache.invalidateQueue(queueId)
    await QueuesCache.invalidateByCompany(member.queue.companyId)
    await QueuesCache.invalidateAll()
}
