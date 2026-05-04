import type { FastifyRequest, FastifyReply } from 'fastify'
import { createExtensionSchema, updateExtensionSchema, idParamSchema, companyIdParamSchema } from './schemas/extension.schema'
import * as ExtensionService from './extensions.service'
import { handleError } from '../../utils/handlers/handler.errors'

export const getExtensions = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const extensions = await ExtensionService.getAllExtensions()

        return reply.send({
            success: true,
            extensions
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getExtensionById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)

        const extension = await ExtensionService.getExtensionById(id)
        if (!extension) return reply.status(404).send({
            success: false,
            message: 'Extension not found'
        })

        return reply.send({
            success: true,
            extension
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getCompanyExtensions = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { companyId } = companyIdParamSchema.parse(req.params)

        const extensions = await ExtensionService.getCompanyExtensions(companyId)

        return reply.send({
            success: true,
            extensions
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createExtension = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createExtensionSchema.parse(req.body)
        const extension = await ExtensionService.createExtension(data)

        if (!extension) {
            return reply.status(500).send({
                success: false,
                message: 'Failed to create extension'
            })
        }

        return reply.status(201).send({
            success: true,
            message: 'Extension created successfully',
            extension_id: extension.id
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateExtension = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateExtensionSchema.parse(req.body)

        const existingExtension = await ExtensionService.getExtensionById(id)
        if (!existingExtension) {
            return reply.status(404).send({
                success: false,
                message: 'Extension not found'
            })
        }

        await ExtensionService.updateExtension(id, data)

        return reply.send({
            success: true,
            message: 'Extension updated successfully'
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteExtension = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)

        const extension = await ExtensionService.deleteExtension(id)
        if (!extension) return reply.status(404).send({
            success: false,
            message: 'Extension not found'
        })

        return reply.send({
            success: true,
            message: 'Extension deleted successfully'
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
