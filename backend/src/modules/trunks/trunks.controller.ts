import type { FastifyRequest, FastifyReply } from 'fastify'
import * as TrunksService from './trunks.service'
import { createTrunkSchema, updateTrunkSchema, trunkIdParamSchema, trunkQuerySchema } from './schemas/trunk.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const getTrunks = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { companyId } = trunkQuerySchema.parse(req.query)
        req.scope.assertAccess(companyId)
        const trunks = await TrunksService.getTrunks(companyId)
        return reply.send({ success: true, message: 'Trunks fetched successfully', trunks })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getTrunkById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = trunkIdParamSchema.parse(req.params)
        const owner = await prisma.trunk.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Trunk not found', 404)
        req.scope.assertAccess(owner.companyId)
        const trunk = await TrunksService.getTrunkById(id)
        return reply.send({ success: true, message: 'Trunk fetched successfully', trunk })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createTrunk = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createTrunkSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const trunk = await TrunksService.createTrunk(data)
        return reply.status(201).send({ success: true, message: 'Trunk created successfully', trunk })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateTrunk = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = trunkIdParamSchema.parse(req.params)
        const data = updateTrunkSchema.parse(req.body)
        const owner = await prisma.trunk.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Trunk not found', 404)
        req.scope.assertAccess(owner.companyId)
        const trunk = await TrunksService.updateTrunk(id, data)
        return reply.send({ success: true, message: 'Trunk updated successfully', trunk })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteTrunk = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = trunkIdParamSchema.parse(req.params)
        const owner = await prisma.trunk.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Trunk not found', 404)
        req.scope.assertAccess(owner.companyId)
        await TrunksService.deleteTrunk(id)
        return reply.send({ success: true, message: 'Trunk deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
