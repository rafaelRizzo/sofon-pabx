import { db } from '../../db/config/db'
import { eq, and } from 'drizzle-orm'
import { queueMembers } from '../../db/schemas/queue-members'
import { queues } from '../../db/schemas/queues'
import { extensions } from '../../db/schemas/extensions'
import { AppError } from '../../utils/handlers/app.error'
import { QueuesCache } from './cache/queues.cache'

import type {
    AddMemberInput,
    UpdateMemberInput,
} from './schemas/queue-member.schema'

const memberSelect = {
    id: queueMembers.id,
    queue_id: queueMembers.queue_id,
    extension_id: queueMembers.extension_id,
    penalty: queueMembers.penalty,
    paused: queueMembers.paused,
    created_at: queueMembers.created_at,
    updated_at: queueMembers.updated_at,
} as const

export const getQueueMembers = async (queueId: string) => {
    const [queue] = await db
        .select()
        .from(queues)
        .where(eq(queues.id, queueId))

    if (!queue) {
        throw new AppError('Queue not found', 404)
    }

    return await db
        .select(memberSelect)
        .from(queueMembers)
        .where(eq(queueMembers.queue_id, queueId))
}

export const addMember = async (queueId: string, data: AddMemberInput) => {
    const [queue] = await db
        .select()
        .from(queues)
        .where(eq(queues.id, queueId))

    if (!queue) {
        throw new AppError('Queue not found', 404)
    }

    const [extension] = await db
        .select()
        .from(extensions)
        .where(eq(extensions.id, data.extension_id))

    if (!extension) {
        throw new AppError('Extension not found', 404)
    }

    if (extension.company_id !== queue.company_id) {
        throw new AppError('Extension does not belong to this company', 409)
    }

    const [existingMember] = await db
        .select()
        .from(queueMembers)
        .where(and(
            eq(queueMembers.queue_id, queueId),
            eq(queueMembers.extension_id, data.extension_id)
        ))

    if (existingMember) {
        throw new AppError('Extension is already a member of this queue', 409)
    }

    const [member] = await db
        .insert(queueMembers)
        .values({
            queue_id: queueId,
            extension_id: data.extension_id,
            penalty: data.penalty,
            paused: data.paused,
        })
        .returning(memberSelect)

    await QueuesCache.invalidateQueue(queueId)

    return member
}

export const updateMember = async (queueId: string, memberId: string, data: UpdateMemberInput) => {
    const [member] = await db
        .select()
        .from(queueMembers)
        .where(and(
            eq(queueMembers.id, memberId),
            eq(queueMembers.queue_id, queueId)
        ))

    if (!member) {
        throw new AppError('Member not found in this queue', 404)
    }

    const updateData: Record<string, any> = {}

    if (data.penalty !== undefined) updateData.penalty = data.penalty
    if (data.paused !== undefined) updateData.paused = data.paused

    const [updatedMember] = await db
        .update(queueMembers)
        .set(updateData)
        .where(eq(queueMembers.id, memberId))
        .returning(memberSelect)

    await QueuesCache.invalidateQueue(queueId)

    return updatedMember ?? null
}

export const removeMember = async (queueId: string, memberId: string) => {
    const [member] = await db
        .select()
        .from(queueMembers)
        .where(and(
            eq(queueMembers.id, memberId),
            eq(queueMembers.queue_id, queueId)
        ))

    if (!member) {
        throw new AppError('Member not found in this queue', 404)
    }

    await db
        .delete(queueMembers)
        .where(eq(queueMembers.id, memberId))

    await QueuesCache.invalidateQueue(queueId)

    return member
}
