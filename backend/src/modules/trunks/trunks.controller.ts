import type { FastifyRequest, FastifyReply } from 'fastify'
import { createTrunkSchema, updateTrunkSchema, idParamSchema, companyIdParamSchema } from './schemas/trunk.schema'
import * as TrunkService from './trunks.service'
import { handleError } from '../../utils/handlers/handler.errors'

export const getTrunks = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const trunks = await TrunkService.getAllTrunks()

        return reply.send({
            success: true,
            trunks
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getTrunkById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)

        const trunk = await TrunkService.getTrunkById(id)
        if (!trunk) return reply.status(404).send({
            success: false,
            message: 'Trunk not found'
        })

        return reply.send({
            success: true,
            trunk
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getCompanyTrunks = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { companyId } = companyIdParamSchema.parse(req.params)

        const trunks = await TrunkService.getCompanyTrunks(companyId)

        return reply.send({
            success: true,
            trunks
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createTrunk = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createTrunkSchema.parse(req.body)
        const trunk = await TrunkService.createTrunk(data)

        if (!trunk) {
            return reply.status(500).send({
                success: false,
                message: 'Failed to create trunk'
            })
        }

        return reply.status(201).send({
            success: true,
            message: 'Trunk created successfully',
            trunk_id: trunk.id
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateTrunk = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateTrunkSchema.parse(req.body)

        const existingTrunk = await TrunkService.getTrunkById(id)
        if (!existingTrunk) {
            return reply.status(404).send({
                success: false,
                message: 'Trunk not found'
            })
        }

        await TrunkService.updateTrunk(id, data)

        return reply.send({
            success: true,
            message: 'Trunk updated successfully'
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteTrunk = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)

        const trunk = await TrunkService.deleteTrunk(id)
        if (!trunk) return reply.status(404).send({
            success: false,
            message: 'Trunk not found'
        })

        return reply.send({
            success: true,
            message: 'Trunk deleted successfully'
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
