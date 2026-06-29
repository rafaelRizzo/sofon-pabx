import type { FastifyRequest, FastifyReply } from 'fastify'
import * as DidsService from './dids.service'
import { createDidSchema, updateDidSchema, idParamSchema, companyQuerySchema, companyIdParamSchema } from './schemas/did.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const getDids = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const filter = companyQuerySchema.safeParse(req.query)

        if (filter.success) {
            req.scope.assertAccess(filter.data.companyId)
            const dids = await DidsService.getDidsByCompany(filter.data.companyId)
            return reply.send({ success: true, message: 'DIDs fetched successfully', dids })
        }

        const { companyIds } = req.scope
        if (companyIds?.length === 1) {
            const dids = await DidsService.getDidsByCompany(companyIds[0]!)
            return reply.send({ success: true, message: 'DIDs fetched successfully', dids })
        }

        const dids = await DidsService.getAllDids(companyIds ?? undefined)
        return reply.send({ success: true, message: 'DIDs fetched successfully', dids })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getDidsByCompanyId = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id_company } = companyIdParamSchema.parse(req.params)
        req.scope.assertAccess(id_company)
        const dids = await DidsService.getDidsByCompany(id_company)
        return reply.send({ success: true, message: 'DIDs fetched successfully', dids })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getDidById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.did.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('DID not found', 404)
        req.scope.assertAccess(owner.companyId)
        const did = await DidsService.getDidById(id)
        return reply.send({ success: true, message: 'DID fetched successfully', did })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createDid = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createDidSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const did = await DidsService.createDid(data)
        return reply.status(201).send({ success: true, message: 'DID created successfully', didId: did.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateDid = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateDidSchema.parse(req.body)
        const existing = await prisma.did.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('DID not found', 404)
        req.scope.assertAccess(existing.companyId)
        await DidsService.updateDid(id, data)
        return reply.send({ success: true, message: 'DID updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteDid = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const existing = await prisma.did.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('DID not found', 404)
        req.scope.assertAccess(existing.companyId)
        await DidsService.deleteDid(id)
        return reply.send({ success: true, message: 'DID deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
