import type { FastifyRequest, FastifyReply } from 'fastify'
import * as VariableConditionsService from './variable-conditions.service'
import { createVariableConditionSchema, updateVariableConditionSchema, idParamSchema, companyQuerySchema } from './schemas/variable-condition.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const getVariableConditionsByCompanyId = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const filter = companyQuerySchema.safeParse(req.query)

        if (filter.success) {
            req.scope.assertAccess(filter.data.companyId)
            const variableConditions = await VariableConditionsService.getVariableConditionsByCompany(filter.data.companyId)
            return reply.send({ success: true, message: 'Variable conditions fetched successfully', variableConditions })
        }

        const { companyIds } = req.scope
        if (companyIds?.length === 1) {
            const variableConditions = await VariableConditionsService.getVariableConditionsByCompany(companyIds[0]!)
            return reply.send({ success: true, message: 'Variable conditions fetched successfully', variableConditions })
        }

        const variableConditions = await VariableConditionsService.getAllVariableConditions(companyIds ?? undefined)
        return reply.send({ success: true, message: 'Variable conditions fetched successfully', variableConditions })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getVariableConditionById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.variableCondition.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Variable condition not found', 404)
        req.scope.assertAccess(owner.companyId)
        const variableCondition = await VariableConditionsService.getVariableConditionById(id)
        return reply.send({ success: true, message: 'Variable condition fetched successfully', variableCondition })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createVariableCondition = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createVariableConditionSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const variableCondition = await VariableConditionsService.createVariableCondition(data)
        return reply.status(201).send({ success: true, message: 'Variable condition created successfully', variableConditionId: variableCondition.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateVariableCondition = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateVariableConditionSchema.parse(req.body)
        const owner = await prisma.variableCondition.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Variable condition not found', 404)
        req.scope.assertAccess(owner.companyId)
        await VariableConditionsService.updateVariableCondition(id, data)
        return reply.send({ success: true, message: 'Variable condition updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteVariableCondition = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.variableCondition.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Variable condition not found', 404)
        req.scope.assertAccess(owner.companyId)
        await VariableConditionsService.deleteVariableCondition(id)
        return reply.send({ success: true, message: 'Variable condition deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
