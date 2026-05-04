import type { FastifyRequest, FastifyReply } from 'fastify'
import { createQueueSchema, updateQueueSchema, idParamSchema, companyIdParamSchema } from './schemas/queue.schema'
import { addMemberSchema, updateMemberSchema, queueIdParamSchema, memberIdParamSchema } from './schemas/queue-member.schema'
import * as QueueService from './queues.service'
import * as QueueMemberService from './queue-members.service'
import { handleError } from '../../utils/handlers/handler.errors'

export const getQueues = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const queues = await QueueService.getAllQueues()

        return reply.send({
            success: true,
            queues
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getQueueById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)

        const queue = await QueueService.getQueueById(id)
        if (!queue) return reply.status(404).send({
            success: false,
            message: 'Queue not found'
        })

        return reply.send({
            success: true,
            queue
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getCompanyQueues = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { companyId } = companyIdParamSchema.parse(req.params)

        const queues = await QueueService.getCompanyQueues(companyId)

        return reply.send({
            success: true,
            queues
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createQueue = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createQueueSchema.parse(req.body)
        const queue = await QueueService.createQueue(data)

        if (!queue) {
            return reply.status(500).send({
                success: false,
                message: 'Failed to create queue'
            })
        }

        return reply.status(201).send({
            success: true,
            message: 'Queue created successfully',
            queue_id: queue.id
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateQueue = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateQueueSchema.parse(req.body)

        const existingQueue = await QueueService.getQueueById(id)
        if (!existingQueue) {
            return reply.status(404).send({
                success: false,
                message: 'Queue not found'
            })
        }

        await QueueService.updateQueue(id, data)

        return reply.send({
            success: true,
            message: 'Queue updated successfully'
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteQueue = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)

        const queue = await QueueService.deleteQueue(id)
        if (!queue) return reply.status(404).send({
            success: false,
            message: 'Queue not found'
        })

        return reply.send({
            success: true,
            message: 'Queue deleted successfully'
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getQueueMembers = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { queueId } = queueIdParamSchema.parse(req.params)

        const members = await QueueMemberService.getQueueMembers(queueId)

        return reply.send({
            success: true,
            members
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const addQueueMember = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { queueId } = queueIdParamSchema.parse(req.params)
        const data = addMemberSchema.parse(req.body)

        const member = await QueueMemberService.addMember(queueId, data)

        if (!member) {
            return reply.status(500).send({
                success: false,
                message: 'Failed to add member'
            })
        }

        return reply.status(201).send({
            success: true,
            message: 'Member added successfully',
            member_id: member.id
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateQueueMember = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const params = req.params as Record<string, string>
        const queueId = queueIdParamSchema.parse({ queueId: params.queueId }).queueId
        const memberId = memberIdParamSchema.parse({ memberId: params.memberId }).memberId

        const data = updateMemberSchema.parse(req.body)

        const updatedMember = await QueueMemberService.updateMember(queueId, memberId, data)

        if (!updatedMember) {
            return reply.status(404).send({
                success: false,
                message: 'Member not found'
            })
        }

        return reply.send({
            success: true,
            message: 'Member updated successfully'
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const removeQueueMember = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const params = req.params as Record<string, string>
        const queueId = queueIdParamSchema.parse({ queueId: params.queueId }).queueId
        const memberId = memberIdParamSchema.parse({ memberId: params.memberId }).memberId

        const member = await QueueMemberService.removeMember(queueId, memberId)

        if (!member) {
            return reply.status(404).send({
                success: false,
                message: 'Member not found'
            })
        }

        return reply.send({
            success: true,
            message: 'Member removed successfully'
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
