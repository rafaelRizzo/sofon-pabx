import type { FastifyRequest, FastifyReply } from 'fastify'
import * as DidsService from './dids.service'
import { createDidSchema, updateDidSchema, idParamSchema, companyQuerySchema, companyIdParamSchema } from './schemas/did.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'

export const getDids = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { role } = req.user!

        if (role === 'admin') {
            const dids = await DidsService.getAllDids()
            return reply.send({ success: true, message: 'DIDs fetched successfully', dids })
        }

        const result = companyQuerySchema.safeParse(req.query)
        if (!result.success) throw new AppError('companyId is required', 400)

        const dids = await DidsService.getDidsByCompany(result.data.companyId)
        return reply.send({ success: true, message: 'DIDs fetched successfully', dids })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getDidsByCompanyId = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id_company } = companyIdParamSchema.parse(req.params)
        const dids = await DidsService.getDidsByCompany(id_company)
        return reply.send({ success: true, message: 'DIDs fetched successfully', dids })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getDidById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const did = await DidsService.getDidById(id)
        return reply.send({ success: true, message: 'DID fetched successfully', did })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createDid = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createDidSchema.parse(req.body)
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
        await DidsService.updateDid(id, data)
        return reply.send({ success: true, message: 'DID updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteDid = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        await DidsService.deleteDid(id)
        return reply.send({ success: true, message: 'DID deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
