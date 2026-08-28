import type { FastifyRequest, FastifyReply } from 'fastify'
import * as FormatterNodesService from './formatter-nodes.service'
import { createFormatterNodeSchema, updateFormatterNodeSchema, idParamSchema, companyQuerySchema } from './schemas/formatter-node.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const getFormatterNodes = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const filter = companyQuerySchema.safeParse(req.query)

        if (filter.success) {
            req.scope.assertAccess(filter.data.companyId)
            const formatterNodes = await FormatterNodesService.getFormatterNodesByCompany(filter.data.companyId)
            return reply.send({ success: true, message: 'Formatter nodes fetched successfully', formatterNodes })
        }

        const { companyIds } = req.scope
        if (companyIds?.length === 1) {
            const formatterNodes = await FormatterNodesService.getFormatterNodesByCompany(companyIds[0]!)
            return reply.send({ success: true, message: 'Formatter nodes fetched successfully', formatterNodes })
        }

        const formatterNodes = await FormatterNodesService.getAllFormatterNodes(companyIds ?? undefined)
        return reply.send({ success: true, message: 'Formatter nodes fetched successfully', formatterNodes })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getFormatterNodeById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.formatterNode.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Formatter node not found', 404)
        req.scope.assertAccess(owner.companyId)
        const formatterNode = await FormatterNodesService.getFormatterNodeById(id)
        return reply.send({ success: true, message: 'Formatter node fetched successfully', formatterNode })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createFormatterNode = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createFormatterNodeSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const formatterNode = await FormatterNodesService.createFormatterNode(data)
        return reply.status(201).send({ success: true, message: 'Formatter node created successfully', formatterNodeId: formatterNode.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateFormatterNode = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateFormatterNodeSchema.parse(req.body)
        const existing = await prisma.formatterNode.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Formatter node not found', 404)
        req.scope.assertAccess(existing.companyId)
        await FormatterNodesService.updateFormatterNode(id, data)
        return reply.send({ success: true, message: 'Formatter node updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteFormatterNode = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const existing = await prisma.formatterNode.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Formatter node not found', 404)
        req.scope.assertAccess(existing.companyId)
        await FormatterNodesService.deleteFormatterNode(id)
        return reply.send({ success: true, message: 'Formatter node deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
