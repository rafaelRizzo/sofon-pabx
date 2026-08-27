import type { FastifyRequest, FastifyReply } from 'fastify'
import * as VariableCatalogService from './variable-catalog.service'
import { createVariableSchema, updateVariableSchema, idParamSchema, companyQuerySchema } from './schemas/variable-catalog.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const getVariablesByCompanyId = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { companyId } = companyQuerySchema.parse(req.query)
        req.scope.assertAccess(companyId)
        const variables = await VariableCatalogService.getVariablesByCompany(companyId)
        return reply.send({ success: true, message: 'Variables fetched successfully', variables })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getVariableById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.variable.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Variable not found', 404)
        req.scope.assertAccess(owner.companyId)
        const variable = await VariableCatalogService.getVariableById(id)
        return reply.send({ success: true, message: 'Variable fetched successfully', variable })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createVariable = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createVariableSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const variable = await VariableCatalogService.createVariable(data)
        return reply.status(201).send({ success: true, message: 'Variable created successfully', variableId: variable.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateVariable = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateVariableSchema.parse(req.body)
        const owner = await prisma.variable.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Variable not found', 404)
        req.scope.assertAccess(owner.companyId)
        await VariableCatalogService.updateVariable(id, data)
        return reply.send({ success: true, message: 'Variable updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteVariable = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.variable.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Variable not found', 404)
        req.scope.assertAccess(owner.companyId)
        await VariableCatalogService.deleteVariable(id)
        return reply.send({ success: true, message: 'Variable deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
