import type { FastifyRequest, FastifyReply } from 'fastify'
import * as IxcNodesService from './ixc-nodes.service'
import { createIxcNodeSchema, updateIxcNodeSchema, testIxcNodeSchema, idParamSchema, companyQuerySchema } from './schemas/ixc-node.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const getIxcNodes = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const filter = companyQuerySchema.safeParse(req.query)

        if (filter.success) {
            req.scope.assertAccess(filter.data.companyId)
            const ixcNodes = await IxcNodesService.getIxcNodesByCompany(filter.data.companyId)
            return reply.send({ success: true, message: 'IXC nodes fetched successfully', ixcNodes })
        }

        const { companyIds } = req.scope
        if (companyIds?.length === 1) {
            const ixcNodes = await IxcNodesService.getIxcNodesByCompany(companyIds[0]!)
            return reply.send({ success: true, message: 'IXC nodes fetched successfully', ixcNodes })
        }

        const ixcNodes = await IxcNodesService.getAllIxcNodes(companyIds ?? undefined)
        return reply.send({ success: true, message: 'IXC nodes fetched successfully', ixcNodes })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getIxcNodeById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.ixcNode.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('IXC node not found', 404)
        req.scope.assertAccess(owner.companyId)
        const ixcNode = await IxcNodesService.getIxcNodeById(id)
        return reply.send({ success: true, message: 'IXC node fetched successfully', ixcNode })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createIxcNode = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createIxcNodeSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const ixcNode = await IxcNodesService.createIxcNode(data)
        return reply.status(201).send({ success: true, message: 'IXC node created successfully', ixcNodeId: ixcNode.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const testIxcNode = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = testIxcNodeSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const result = await IxcNodesService.testIxcNode(data)
        return reply.send({ success: true, message: 'IXC test executed', result })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateIxcNode = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateIxcNodeSchema.parse(req.body)
        const existing = await prisma.ixcNode.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('IXC node not found', 404)
        req.scope.assertAccess(existing.companyId)
        await IxcNodesService.updateIxcNode(id, data)
        return reply.send({ success: true, message: 'IXC node updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteIxcNode = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const existing = await prisma.ixcNode.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('IXC node not found', 404)
        req.scope.assertAccess(existing.companyId)
        await IxcNodesService.deleteIxcNode(id)
        return reply.send({ success: true, message: 'IXC node deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
