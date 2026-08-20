import type { FastifyRequest, FastifyReply } from 'fastify'
import * as ExtensionsService from './extensions.service'
import { createExtensionSchema, createExtensionBatchSchema, updateExtensionSchema, extensionIdParamSchema, extensionQuerySchema, BATCH_LIMIT } from './schemas/extension.schema'
import { handleError } from '../../utils/errors/handler.error'

export const getAllExtensions = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const filter = extensionQuerySchema.safeParse(req.query)

        if (filter.success) {
            req.scope.assertAccess(filter.data.companyId)
            const extensions = await ExtensionsService.getAllExtensions([filter.data.companyId])
            return reply.send({ success: true, message: 'Extensions fetched successfully', extensions })
        }

        const extensions = await ExtensionsService.getAllExtensions(req.scope.companyIds ?? undefined, req.user!.id)
        return reply.send({ success: true, message: 'Extensions fetched successfully', extensions })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const exportExtensions = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const filter = extensionQuerySchema.safeParse(req.query)

        if (filter.success) {
            req.scope.assertAccess(filter.data.companyId)
            const extensions = await ExtensionsService.getExtensionsForExport([filter.data.companyId])
            return reply.send({ success: true, message: 'Extensions exported successfully', extensions })
        }

        const extensions = await ExtensionsService.getExtensionsForExport(req.scope.companyIds ?? undefined, req.user!.id)
        return reply.send({ success: true, message: 'Extensions exported successfully', extensions })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getMyWebrtcCredentials = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const webrtc = await ExtensionsService.getMyWebrtcCredentials(req.user!.id)
        return reply.send({ success: true, message: 'WebRTC credentials fetched successfully', webrtc })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getExtensionById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = extensionIdParamSchema.parse(req.params)
        const owner = await ExtensionsService.getExtensionDto(id)
        req.scope.assertAccess(owner.companyId)
        const extension = await ExtensionsService.getExtensionById(id)
        return reply.send({ success: true, message: 'Extension fetched successfully', extension })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createExtension = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createExtensionSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const extension = await ExtensionsService.createExtension(data)
        return reply.status(201).send({ success: true, message: 'Extension created successfully', extension })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createExtensionBatch = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { extensions } = createExtensionBatchSchema.parse(req.body)

        const companyIds = [...new Set(extensions.map((e) => e.companyId))]
        for (const cid of companyIds) req.scope.assertAccess(cid)

        const result = await ExtensionsService.createExtensionBatch(extensions)

        const status = result.errors.length === 0 ? 201 : result.created.length === 0 ? 422 : 207
        return reply.status(status).send({ success: result.created.length > 0, ...result })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateExtension = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = extensionIdParamSchema.parse(req.params)
        const data = updateExtensionSchema.parse(req.body)

        const existing = await ExtensionsService.getExtensionDto(id)

        req.scope.assertAccess(existing.companyId)
        const extension = await ExtensionsService.updateExtension(id, data)
        return reply.send({ success: true, message: 'Extension updated successfully', extension })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteExtension = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = extensionIdParamSchema.parse(req.params)

        const extension = await ExtensionsService.getExtensionDto(id)

        req.scope.assertAccess(extension.companyId)
        await ExtensionsService.deleteExtension(id)
        return reply.send({ success: true, message: 'Extension deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const resetExtensionPassword = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = extensionIdParamSchema.parse(req.params)

        const extension = await ExtensionsService.getExtensionDto(id)

        req.scope.assertAccess(extension.companyId)
        const result = await ExtensionsService.resetExtensionPassword(id)
        return reply.send({ success: true, message: 'Password reset successfully', password: result.password })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
