import type { FastifyRequest, FastifyReply } from 'fastify'
import * as TimeConditionsService from './time-conditions.service'
import { createTimeConditionSchema, updateTimeConditionSchema, idParamSchema, companyQuerySchema } from './schemas/time-condition.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const getTimeConditionsByCompanyId = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const filter = companyQuerySchema.safeParse(req.query)

        if (filter.success) {
            req.scope.assertAccess(filter.data.companyId)
            const conditions = await TimeConditionsService.getTimeConditionsByCompany(filter.data.companyId)
            return reply.send({ success: true, message: 'Time conditions fetched successfully', timeConditions: conditions })
        }

        const { companyIds } = req.scope
        if (companyIds?.length === 1) {
            const conditions = await TimeConditionsService.getTimeConditionsByCompany(companyIds[0]!)
            return reply.send({ success: true, message: 'Time conditions fetched successfully', timeConditions: conditions })
        }

        const conditions = await TimeConditionsService.getAllTimeConditions(companyIds ?? undefined)
        return reply.send({ success: true, message: 'Time conditions fetched successfully', timeConditions: conditions })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getTimeConditionById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.timeCondition.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Time condition not found', 404)
        req.scope.assertAccess(owner.companyId)
        const tc = await TimeConditionsService.getTimeConditionById(id)
        return reply.send({ success: true, message: 'Time condition fetched successfully', timeCondition: tc })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createTimeCondition = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createTimeConditionSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const tc = await TimeConditionsService.createTimeCondition(data)
        return reply.status(201).send({ success: true, message: 'Time condition created successfully', timeConditionId: tc.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateTimeCondition = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateTimeConditionSchema.parse(req.body)
        const owner = await prisma.timeCondition.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Time condition not found', 404)
        req.scope.assertAccess(owner.companyId)
        await TimeConditionsService.updateTimeCondition(id, data)
        return reply.send({ success: true, message: 'Time condition updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteTimeCondition = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.timeCondition.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Time condition not found', 404)
        req.scope.assertAccess(owner.companyId)
        await TimeConditionsService.deleteTimeCondition(id)
        return reply.send({ success: true, message: 'Time condition deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
