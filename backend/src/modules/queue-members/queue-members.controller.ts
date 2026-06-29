import type { FastifyRequest, FastifyReply } from 'fastify'
import * as QueueMembersService from './queue-members.service'
import { addMemberSchema, updateMemberSchema, memberIdParamSchema, queueIdParamSchema } from './schemas/queue-member.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const getQueueMembers = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = queueIdParamSchema.parse(req.params)
        const owner = await prisma.queue.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Queue not found', 404)
        req.scope.assertAccess(owner.companyId)
        const members = await QueueMembersService.getQueueMembers(id)
        return reply.send({ success: true, message: 'Members fetched successfully', members })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const addMember = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = queueIdParamSchema.parse(req.params)
        const data = addMemberSchema.parse(req.body)
        const owner = await prisma.queue.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Queue not found', 404)
        req.scope.assertAccess(owner.companyId)
        const member = await QueueMembersService.addMember(id, data)
        return reply.status(201).send({ success: true, message: 'Member added successfully', memberId: member.id })
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

        if (!req.scope.isAdmin) {
            const member = await prisma.queueMember.findUnique({ where: { id: memberId }, select: { extensionId: true } })
            if (!member) throw new AppError('Member not found', 404)
            const agent = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { extensionId: true } })
            if (!agent?.extensionId || agent.extensionId !== member.extensionId)
                throw new AppError('Forbidden', 403)
        }

        await QueueMembersService.updateMember(id, memberId, data)
        return reply.send({ success: true, message: 'Member updated successfully' })
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
        await QueueMembersService.removeMember(id, memberId)
        return reply.send({ success: true, message: 'Member removed successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
