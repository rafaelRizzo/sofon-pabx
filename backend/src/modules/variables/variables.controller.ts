import type { FastifyRequest, FastifyReply } from 'fastify'
import * as VariablesService from './variables.service'
import { createVariableSetSchema, updateVariableSetSchema, idParamSchema, companyQuerySchema } from './schemas/variable.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const getVariableSets = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const filter = companyQuerySchema.safeParse(req.query)

        if (filter.success) {
            req.scope.assertAccess(filter.data.companyId)
            const variableSets = await VariablesService.getVariableSetsByCompany(filter.data.companyId)
            return reply.send({ success: true, message: 'Variable sets fetched successfully', variableSets })
        }

        const { companyIds } = req.scope
        if (companyIds?.length === 1) {
            const variableSets = await VariablesService.getVariableSetsByCompany(companyIds[0]!)
            return reply.send({ success: true, message: 'Variable sets fetched successfully', variableSets })
        }

        const variableSets = await VariablesService.getAllVariableSets(companyIds ?? undefined)
        return reply.send({ success: true, message: 'Variable sets fetched successfully', variableSets })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getVariableSetById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.variableSet.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Variable set not found', 404)
        req.scope.assertAccess(owner.companyId)
        const variableSet = await VariablesService.getVariableSetById(id)
        return reply.send({ success: true, message: 'Variable set fetched successfully', variableSet })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createVariableSet = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createVariableSetSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const variableSet = await VariablesService.createVariableSet(data)
        return reply.status(201).send({ success: true, message: 'Variable set created successfully', variableSetId: variableSet.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateVariableSet = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateVariableSetSchema.parse(req.body)
        const existing = await prisma.variableSet.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Variable set not found', 404)
        req.scope.assertAccess(existing.companyId)
        await VariablesService.updateVariableSet(id, data)
        return reply.send({ success: true, message: 'Variable set updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteVariableSet = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const existing = await prisma.variableSet.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Variable set not found', 404)
        req.scope.assertAccess(existing.companyId)
        await VariablesService.deleteVariableSet(id)
        return reply.send({ success: true, message: 'Variable set deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
