import type { FastifyRequest, FastifyReply } from 'fastify'
import * as TrunksService from './trunks.service'
import {
    createTrunkSchema, updateTrunkSchema, setTrunkActiveSchema, trunkIdParamSchema, trunkQuerySchema,
} from './schemas/trunk.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const getTrunks = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const filter = trunkQuerySchema.safeParse(req.query)

        if (filter.success) {
            req.scope.assertAccess(filter.data.companyId)
            const trunks = await TrunksService.getTrunks(filter.data.companyId)
            return reply.send({ success: true, message: 'Trunks fetched successfully', trunks })
        }

        const { companyIds } = req.scope
        if (companyIds?.length === 1) {
            const trunks = await TrunksService.getTrunks(companyIds[0]!)
            return reply.send({ success: true, message: 'Trunks fetched successfully', trunks })
        }

        const trunks = await TrunksService.getAllTrunks(companyIds ?? undefined, req.user!.id)
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

export const setTrunkActive = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = trunkIdParamSchema.parse(req.params)
        const { active } = setTrunkActiveSchema.parse(req.body)
        const owner = await prisma.trunk.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Trunk not found', 404)
        req.scope.assertAccess(owner.companyId)
        const trunk = await TrunksService.setTrunkActive(id, active)
        return reply.send({ success: true, message: `Trunk ${active ? 'ativado' : 'desativado'} com sucesso`, trunk })
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
