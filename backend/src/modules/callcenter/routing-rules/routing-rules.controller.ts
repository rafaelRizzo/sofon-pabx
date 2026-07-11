import type { FastifyRequest, FastifyReply } from 'fastify'
import * as RoutingRulesService from './routing-rules.service'
import { createRoutingRuleSchema, updateRoutingRuleSchema, idParamSchema, companyIdParamSchema } from './schemas/routing-rule.schema'
import { handleError } from '../../../utils/errors/handler.error'
import { AppError } from '../../../utils/errors/app.error'
import { prisma } from '../../../lib/prisma'

export const getRoutingRulesByCompanyId = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id_company } = companyIdParamSchema.parse(req.params)
        req.scope.assertAccess(id_company)
        const routingRules = await RoutingRulesService.getRoutingRulesByCompany(id_company)
        return reply.send({ success: true, message: 'Routing rules fetched successfully', routingRules })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getRoutingRuleById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.routingRule.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Routing rule not found', 404)
        req.scope.assertAccess(owner.companyId)
        const routingRule = await RoutingRulesService.getRoutingRuleById(id)
        return reply.send({ success: true, message: 'Routing rule fetched successfully', routingRule })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createRoutingRule = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createRoutingRuleSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const rule = await RoutingRulesService.createRoutingRule(data)
        return reply.status(201).send({ success: true, message: 'Routing rule created successfully', routingRuleId: rule.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateRoutingRule = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateRoutingRuleSchema.parse(req.body)
        const existing = await prisma.routingRule.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Routing rule not found', 404)
        req.scope.assertAccess(existing.companyId)
        await RoutingRulesService.updateRoutingRule(id, data)
        return reply.send({ success: true, message: 'Routing rule updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteRoutingRule = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const existing = await prisma.routingRule.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Routing rule not found', 404)
        req.scope.assertAccess(existing.companyId)
        await RoutingRulesService.deleteRoutingRule(id)
        return reply.send({ success: true, message: 'Routing rule deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
