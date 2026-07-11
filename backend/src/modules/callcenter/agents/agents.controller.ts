import type { FastifyRequest, FastifyReply } from 'fastify'
import * as AgentsService from './agents.service'
import { createAgentScopeSchema, updateAgentScopeSchema, idParamSchema, companyIdParamSchema } from './schemas/agent-scope.schema'
import { handleError } from '../../../utils/errors/handler.error'
import { AppError } from '../../../utils/errors/app.error'
import { prisma } from '../../../lib/prisma'

export const getScopesByCompanyId = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id_company } = companyIdParamSchema.parse(req.params)
        req.scope.assertAccess(id_company)
        const scopes = await AgentsService.getScopesByCompany(id_company)
        return reply.send({ success: true, message: 'Agent scopes fetched successfully', scopes })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createScope = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createAgentScopeSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const scope = await AgentsService.createScope(data)
        return reply.status(201).send({ success: true, message: 'Agent scope created successfully', scopeId: scope.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateScope = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateAgentScopeSchema.parse(req.body)
        const existing = await prisma.agentCompanyScope.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Agent scope not found', 404)
        req.scope.assertAccess(existing.companyId)
        await AgentsService.updateScope(id, data)
        return reply.send({ success: true, message: 'Agent scope updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteScope = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const existing = await prisma.agentCompanyScope.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Agent scope not found', 404)
        req.scope.assertAccess(existing.companyId)
        await AgentsService.deleteScope(id)
        return reply.send({ success: true, message: 'Agent scope deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
