import type { FastifyRequest, FastifyReply } from 'fastify'
import * as HolidayGroupsService from './holiday-groups.service'
import { createHolidayGroupSchema, updateHolidayGroupSchema, idParamSchema, companyQuerySchema } from './schemas/holiday-group.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const getHolidayGroupsByCompanyId = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { companyId } = companyQuerySchema.parse(req.query)
        req.scope.assertAccess(companyId)
        const groups = await HolidayGroupsService.getHolidayGroupsByCompany(companyId)
        return reply.send({ success: true, message: 'Holiday groups fetched successfully', holidayGroups: groups })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getHolidayGroupById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.holidayGroup.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Holiday group not found', 404)
        req.scope.assertAccess(owner.companyId)
        const hg = await HolidayGroupsService.getHolidayGroupById(id)
        return reply.send({ success: true, message: 'Holiday group fetched successfully', holidayGroup: hg })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createHolidayGroup = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createHolidayGroupSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const hg = await HolidayGroupsService.createHolidayGroup(data)
        return reply.status(201).send({ success: true, message: 'Holiday group created successfully', holidayGroupId: hg.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateHolidayGroup = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateHolidayGroupSchema.parse(req.body)
        const owner = await prisma.holidayGroup.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Holiday group not found', 404)
        req.scope.assertAccess(owner.companyId)
        await HolidayGroupsService.updateHolidayGroup(id, data)
        return reply.send({ success: true, message: 'Holiday group updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteHolidayGroup = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.holidayGroup.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Holiday group not found', 404)
        req.scope.assertAccess(owner.companyId)
        await HolidayGroupsService.deleteHolidayGroup(id)
        return reply.send({ success: true, message: 'Holiday group deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
