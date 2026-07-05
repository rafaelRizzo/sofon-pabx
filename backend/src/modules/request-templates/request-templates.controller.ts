import type { FastifyRequest, FastifyReply } from 'fastify'
import * as RequestTemplatesService from './request-templates.service'
import { createRequestTemplateSchema, updateRequestTemplateSchema, idParamSchema, companyQuerySchema } from './schemas/request-template.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const getRequestTemplates = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const filter = companyQuerySchema.safeParse(req.query)

        if (filter.success) {
            req.scope.assertAccess(filter.data.companyId)
            const requestTemplates = await RequestTemplatesService.getRequestTemplatesByCompany(filter.data.companyId)
            return reply.send({ success: true, message: 'Request templates fetched successfully', requestTemplates })
        }

        const { companyIds } = req.scope
        if (companyIds?.length === 1) {
            const requestTemplates = await RequestTemplatesService.getRequestTemplatesByCompany(companyIds[0]!)
            return reply.send({ success: true, message: 'Request templates fetched successfully', requestTemplates })
        }

        const requestTemplates = await RequestTemplatesService.getAllRequestTemplates(companyIds ?? undefined)
        return reply.send({ success: true, message: 'Request templates fetched successfully', requestTemplates })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getRequestTemplateById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.requestTemplate.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Request template not found', 404)
        req.scope.assertAccess(owner.companyId)
        const requestTemplate = await RequestTemplatesService.getRequestTemplateById(id)
        return reply.send({ success: true, message: 'Request template fetched successfully', requestTemplate })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createRequestTemplate = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createRequestTemplateSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const requestTemplate = await RequestTemplatesService.createRequestTemplate(data)
        return reply.status(201).send({ success: true, message: 'Request template created successfully', requestTemplateId: requestTemplate.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateRequestTemplate = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateRequestTemplateSchema.parse(req.body)
        const existing = await prisma.requestTemplate.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Request template not found', 404)
        req.scope.assertAccess(existing.companyId)
        await RequestTemplatesService.updateRequestTemplate(id, data)
        return reply.send({ success: true, message: 'Request template updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteRequestTemplate = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const existing = await prisma.requestTemplate.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Request template not found', 404)
        req.scope.assertAccess(existing.companyId)
        await RequestTemplatesService.deleteRequestTemplate(id)
        return reply.send({ success: true, message: 'Request template deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
