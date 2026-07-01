import type { FastifyRequest, FastifyReply } from 'fastify'
import * as TimeGroupsService from './time-groups.service'
import { createTimeGroupSchema, updateTimeGroupSchema, idParamSchema, companyQuerySchema } from './schemas/time-group.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const getTimeGroupsByCompanyId = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { companyId } = companyQuerySchema.parse(req.query)
        req.scope.assertAccess(companyId)
        const groups = await TimeGroupsService.getTimeGroupsByCompany(companyId)
        return reply.send({ success: true, message: 'Time groups fetched successfully', timeGroups: groups })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getTimeGroupById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.timeGroup.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Time group not found', 404)
        req.scope.assertAccess(owner.companyId)
        const group = await TimeGroupsService.getTimeGroupById(id)
        return reply.send({ success: true, message: 'Time group fetched successfully', timeGroup: group })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createTimeGroup = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createTimeGroupSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const group = await TimeGroupsService.createTimeGroup(data)
        return reply.status(201).send({ success: true, message: 'Time group created successfully', timeGroupId: group.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateTimeGroup = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateTimeGroupSchema.parse(req.body)
        const owner = await prisma.timeGroup.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Time group not found', 404)
        req.scope.assertAccess(owner.companyId)
        await TimeGroupsService.updateTimeGroup(id, data)
        return reply.send({ success: true, message: 'Time group updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteTimeGroup = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.timeGroup.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Time group not found', 404)
        req.scope.assertAccess(owner.companyId)
        await TimeGroupsService.deleteTimeGroup(id)
        return reply.send({ success: true, message: 'Time group deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
