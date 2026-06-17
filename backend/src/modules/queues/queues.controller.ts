import type { FastifyRequest, FastifyReply } from 'fastify'
import * as QueuesService from './queues.service'
import {
    createQueueSchema,
    updateQueueSchema,
    addMemberSchema,
    updateMemberSchema,
    idParamSchema,
    companyIdParamSchema,
    memberIdParamSchema,
    companyQuerySchema,
} from './schemas/queue.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const getQueues = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const filter = companyQuerySchema.safeParse(req.query)

        if (filter.success) {
            req.scope.assertAccess(filter.data.companyId)
            const queues = await QueuesService.getAllQueues([filter.data.companyId])
            return reply.send({ success: true, message: 'Queues fetched successfully', queues })
        }

        const queues = await QueuesService.getAllQueues(req.scope.companyIds ?? undefined)
        return reply.send({ success: true, message: 'Queues fetched successfully', queues })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getQueuesByCompanyId = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id_company } = companyIdParamSchema.parse(req.params)
        req.scope.assertAccess(id_company)
        const queues = await QueuesService.getQueuesByCompany(id_company)
        return reply.send({ success: true, message: 'Queues fetched successfully', queues })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getQueueById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.queue.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Queue not found', 404)
        req.scope.assertAccess(owner.companyId)
        const queue = await QueuesService.getQueueById(id)
        return reply.send({ success: true, message: 'Queue fetched successfully', queue })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getQueueMembers = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.queue.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Queue not found', 404)
        req.scope.assertAccess(owner.companyId)
        const members = await QueuesService.getQueueMembers(id)
        return reply.send({ success: true, message: 'Members fetched successfully', members })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createQueue = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createQueueSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const queue = await QueuesService.createQueue(data)
        return reply.status(201).send({ success: true, message: 'Queue created successfully', queueId: queue.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const addMember = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = addMemberSchema.parse(req.body)
        const owner = await prisma.queue.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Queue not found', 404)
        req.scope.assertAccess(owner.companyId)
        const member = await QueuesService.addMember(id, data)
        return reply.status(201).send({ success: true, message: 'Member added successfully', memberId: member.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateQueue = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateQueueSchema.parse(req.body)
        const existing = await prisma.queue.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Queue not found', 404)
        req.scope.assertAccess(existing.companyId)
        await QueuesService.updateQueue(id, data)
        return reply.send({ success: true, message: 'Queue updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateMember = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id, memberId } = memberIdParamSchema.parse(req.params)
        const data = updateMemberSchema.parse(req.body)
        const owner = await prisma.queue.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Queue not found', 404)
        req.scope.assertAccess(owner.companyId)
        await QueuesService.updateMember(id, memberId, data)
        return reply.send({ success: true, message: 'Member updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteQueue = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const existing = await prisma.queue.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Queue not found', 404)
        req.scope.assertAccess(existing.companyId)
        await QueuesService.deleteQueue(id)
        return reply.send({ success: true, message: 'Queue deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const removeMember = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id, memberId } = memberIdParamSchema.parse(req.params)
        const owner = await prisma.queue.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Queue not found', 404)
        req.scope.assertAccess(owner.companyId)
        await QueuesService.removeMember(id, memberId)
        return reply.send({ success: true, message: 'Member removed successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
