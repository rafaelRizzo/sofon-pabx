import type { FastifyRequest, FastifyReply } from 'fastify'
import * as IvrService from './ivr.service'
import { createIvrMenuSchema, updateIvrMenuSchema, idParamSchema, companyQuerySchema } from './schemas/ivr.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const getIvrMenus = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { companyId } = companyQuerySchema.parse(req.query)
        req.scope.assertAccess(companyId)
        const ivrMenus = await IvrService.getIvrMenusByCompany(companyId)
        return reply.send({ success: true, message: 'IVR menus fetched successfully', ivrMenus })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getIvrMenuById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.ivrMenu.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('IVR menu not found', 404)
        req.scope.assertAccess(owner.companyId)
        const ivrMenu = await IvrService.getIvrMenuById(id)
        return reply.send({ success: true, message: 'IVR menu fetched successfully', ivrMenu })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createIvrMenu = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createIvrMenuSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const ivrMenu = await IvrService.createIvrMenu(data)
        return reply.status(201).send({ success: true, message: 'IVR menu created successfully', ivrMenuId: ivrMenu.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateIvrMenu = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateIvrMenuSchema.parse(req.body)
        const existing = await prisma.ivrMenu.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('IVR menu not found', 404)
        req.scope.assertAccess(existing.companyId)
        await IvrService.updateIvrMenu(id, data)
        return reply.send({ success: true, message: 'IVR menu updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteIvrMenu = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const existing = await prisma.ivrMenu.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('IVR menu not found', 404)
        req.scope.assertAccess(existing.companyId)
        await IvrService.deleteIvrMenu(id)
        return reply.send({ success: true, message: 'IVR menu deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
