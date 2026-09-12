import type { FastifyRequest, FastifyReply } from 'fastify'
import * as PauseReasonsService from './pause-reasons.service'
import { createPauseReasonSchema, updatePauseReasonSchema, idParamSchema, companyIdParamSchema } from './schemas/pause-reason.schema'
import { handleError } from '../../../utils/errors/handler.error'
import { AppError } from '../../../utils/errors/app.error'
import { prisma } from '../../../lib/prisma'

export const getPauseReasonsByCompanyId = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id_company } = companyIdParamSchema.parse(req.params)
        req.scope.assertAccess(id_company)
        const pauseReasons = await PauseReasonsService.getPauseReasonsByCompany(id_company)
        return reply.send({ success: true, message: 'Pause reasons fetched successfully', pauseReasons })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createPauseReason = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createPauseReasonSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const pauseReason = await PauseReasonsService.createPauseReason(data)
        return reply.status(201).send({ success: true, message: 'Pause reason created successfully', pauseReasonId: pauseReason.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updatePauseReason = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updatePauseReasonSchema.parse(req.body)
        const existing = await prisma.pauseReason.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Pause reason not found', 404)
        req.scope.assertAccess(existing.companyId)
        await PauseReasonsService.updatePauseReason(id, data)
        return reply.send({ success: true, message: 'Pause reason updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deletePauseReason = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const existing = await prisma.pauseReason.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Pause reason not found', 404)
        req.scope.assertAccess(existing.companyId)
        await PauseReasonsService.deletePauseReason(id)
        return reply.send({ success: true, message: 'Pause reason deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
