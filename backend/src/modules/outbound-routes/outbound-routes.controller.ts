import type { FastifyRequest, FastifyReply } from 'fastify'
import * as Service from './outbound-routes.service'
import {
    createOutboundRouteSchema,
    updateOutboundRouteSchema,
    addPatternSchema,
    updatePatternSchema,
    setTrunksSchema,
    addExtensionSchema,
    routeIdParamSchema,
    patternIdParamSchema,
    extensionParamSchema,
    companyQuerySchema,
} from './outbound-routes.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'

export const getRoutes = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { companyId } = companyQuerySchema.parse(req.query)
        req.scope.assertAccess(companyId)
        return reply.send({ success: true, routes: await Service.getOutboundRoutes(companyId) })
    } catch (e) { return handleError(reply, e, req) }
}

export const getRouteById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = routeIdParamSchema.parse(req.params)
        const route = await Service.getOutboundRouteById(id)
        req.scope.assertAccess(route.companyId)
        return reply.send({ success: true, route })
    } catch (e) { return handleError(reply, e, req) }
}

export const createRoute = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createOutboundRouteSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const outboundRouteId = await Service.createOutboundRoute(data)
        return reply.status(201).send({ success: true, message: 'Outbound route created successfully', outboundRouteId })
    } catch (e) { return handleError(reply, e, req) }
}

export const updateRoute = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = routeIdParamSchema.parse(req.params)
        const data = updateOutboundRouteSchema.parse(req.body)
        const existing = await Service.getOutboundRouteById(id)
        req.scope.assertAccess(existing.companyId)
        return reply.send({ success: true, route: await Service.updateOutboundRoute(id, data) })
    } catch (e) { return handleError(reply, e, req) }
}

export const deleteRoute = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = routeIdParamSchema.parse(req.params)
        const existing = await Service.getOutboundRouteById(id)
        req.scope.assertAccess(existing.companyId)
        await Service.deleteOutboundRoute(id)
        return reply.send({ success: true, message: 'Outbound route deleted' })
    } catch (e) { return handleError(reply, e, req) }
}

export const addPattern = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = routeIdParamSchema.parse(req.params)
        const data = addPatternSchema.parse(req.body)
        const existing = await Service.getOutboundRouteById(id)
        req.scope.assertAccess(existing.companyId)
        const patternId = await Service.addPattern(id, data)
        return reply.status(201).send({ success: true, message: 'Pattern added successfully', patternId })
    } catch (e) { return handleError(reply, e, req) }
}

export const updatePattern = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id, patternId } = patternIdParamSchema.parse(req.params)
        const data = updatePatternSchema.parse(req.body)
        const existing = await Service.getOutboundRouteById(id)
        req.scope.assertAccess(existing.companyId)
        await Service.updatePattern(id, patternId, data)
        return reply.send({ success: true, message: 'Pattern updated successfully' })
    } catch (e) { return handleError(reply, e, req) }
}

export const deletePattern = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id, patternId } = patternIdParamSchema.parse(req.params)
        const existing = await Service.getOutboundRouteById(id)
        req.scope.assertAccess(existing.companyId)
        await Service.deletePattern(id, patternId)
        return reply.send({ success: true, message: 'Pattern deleted' })
    } catch (e) { return handleError(reply, e, req) }
}

export const setTrunks = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = routeIdParamSchema.parse(req.params)
        const data = setTrunksSchema.parse(req.body)
        const existing = await Service.getOutboundRouteById(id)
        req.scope.assertAccess(existing.companyId)
        await Service.setTrunks(id, data)
        return reply.send({ success: true, route: await Service.getOutboundRouteById(id) })
    } catch (e) { return handleError(reply, e, req) }
}

export const addExtension = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = routeIdParamSchema.parse(req.params)
        const { extensionId } = addExtensionSchema.parse(req.body)
        const existing = await Service.getOutboundRouteById(id)
        req.scope.assertAccess(existing.companyId)
        const record = await Service.addExtension(id, extensionId)
        return reply.status(201).send({ success: true, message: 'Extension added to route', outboundRouteExtensionId: record.id })
    } catch (e) { return handleError(reply, e, req) }
}

export const removeExtension = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id, extensionId } = extensionParamSchema.parse(req.params)
        const existing = await Service.getOutboundRouteById(id)
        req.scope.assertAccess(existing.companyId)
        await Service.removeExtension(id, extensionId)
        return reply.send({ success: true, message: 'Extension removed from route' })
    } catch (e) { return handleError(reply, e, req) }
}
