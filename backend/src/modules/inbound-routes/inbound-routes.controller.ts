import type { FastifyRequest, FastifyReply } from 'fastify'
import * as InboundRoutesService from './inbound-routes.service'
import { createInboundRouteSchema, updateInboundRouteSchema, idParamSchema, companyQuerySchema } from './schemas/inbound-route.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const getInboundRoutesByCompanyId = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const filter = companyQuerySchema.safeParse(req.query)

        if (filter.success) {
            req.scope.assertAccess(filter.data.companyId)
            const routes = await InboundRoutesService.getInboundRoutesByCompany(filter.data.companyId)
            return reply.send({ success: true, message: 'Inbound routes fetched successfully', inboundRoutes: routes })
        }

        const { companyIds } = req.scope
        if (companyIds?.length === 1) {
            const routes = await InboundRoutesService.getInboundRoutesByCompany(companyIds[0]!)
            return reply.send({ success: true, message: 'Inbound routes fetched successfully', inboundRoutes: routes })
        }

        const routes = await InboundRoutesService.getAllInboundRoutes(companyIds ?? undefined)
        return reply.send({ success: true, message: 'Inbound routes fetched successfully', inboundRoutes: routes })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getInboundRouteById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.inboundRoute.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Inbound route not found', 404)
        req.scope.assertAccess(owner.companyId)
        const route = await InboundRoutesService.getInboundRouteById(id)
        return reply.send({ success: true, message: 'Inbound route fetched successfully', inboundRoute: route })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createInboundRoute = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createInboundRouteSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const route = await InboundRoutesService.createInboundRoute(data)
        return reply.status(201).send({ success: true, message: 'Inbound route created successfully', inboundRouteId: route.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateInboundRoute = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateInboundRouteSchema.parse(req.body)
        const owner = await prisma.inboundRoute.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Inbound route not found', 404)
        req.scope.assertAccess(owner.companyId)
        await InboundRoutesService.updateInboundRoute(id, data)
        return reply.send({ success: true, message: 'Inbound route updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteInboundRoute = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.inboundRoute.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Inbound route not found', 404)
        req.scope.assertAccess(owner.companyId)
        await InboundRoutesService.deleteInboundRoute(id)
        return reply.send({ success: true, message: 'Inbound route deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
