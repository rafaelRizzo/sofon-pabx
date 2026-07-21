import type { FastifyRequest, FastifyReply } from 'fastify'
import * as FlowsService from './flows.service'
import { createFlowSchema, updateFlowSchema, updateFlowLayoutSchema, idParamSchema, companyQuerySchema } from './schemas/flow.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const getFlows = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { companyId } = companyQuerySchema.parse(req.query)
        req.scope.assertAccess(companyId)
        const flows = await FlowsService.getFlowsByCompany(companyId)
        return reply.send({ success: true, message: 'Flows fetched successfully', flows })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getFlowById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.flow.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Flow not found', 404)
        req.scope.assertAccess(owner.companyId)
        const flow = await FlowsService.getFlowById(id)
        return reply.send({ success: true, message: 'Flow fetched successfully', flow })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getFlowGraph = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.flow.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Flow not found', 404)
        req.scope.assertAccess(owner.companyId)
        const { nodes, edges } = await FlowsService.getFlowGraph(id)
        return reply.send({ success: true, message: 'Flow graph fetched successfully', nodes, edges })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createFlow = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createFlowSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const flow = await FlowsService.createFlow(data)
        return reply.status(201).send({ success: true, message: 'Flow created successfully', flowId: flow.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateFlow = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateFlowSchema.parse(req.body)
        const existing = await prisma.flow.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Flow not found', 404)
        req.scope.assertAccess(existing.companyId)
        await FlowsService.updateFlow(id, data)
        return reply.send({ success: true, message: 'Flow updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateFlowLayout = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateFlowLayoutSchema.parse(req.body)
        const existing = await prisma.flow.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Flow not found', 404)
        req.scope.assertAccess(existing.companyId)
        await FlowsService.updateFlowLayout(id, data)
        return reply.send({ success: true, message: 'Flow layout updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteFlow = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const existing = await prisma.flow.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Flow not found', 404)
        req.scope.assertAccess(existing.companyId)
        await FlowsService.deleteFlow(id)
        return reply.send({ success: true, message: 'Flow deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
