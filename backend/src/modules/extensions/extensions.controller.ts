import type { FastifyRequest, FastifyReply } from 'fastify'
import { createExtensionSchema, updateExtensionSchema, idParamSchema, companyIdParamSchema } from './schemas/extension.schema'
import * as ExtensionService from './extensions.service'
import * as CompanyService from '../companies/companies.service'
import { handleError } from '../../utils/handlers/handler.errors'
import { getLoggedUser } from '../../utils/handlers/handler.req.user'

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
        const { role, id: userId } = getLoggedUser(req)

        const extension = await ExtensionService.getExtensionById(id)
        if (!extension) return reply.status(404).send({
            success: false,
            message: 'Extension not found'
        })

        const isAdmin = role === 'admin'
        const company = await CompanyService.getCompanyById(extension.company_id)
        const isOwner = company && company.owner_id.toString() === userId

        if (!isAdmin && !isOwner) {
            return reply.status(403).send({
                success: false,
                message: 'You do not have permission to access this extension',
            })
        }

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
        const { role, id: userId } = getLoggedUser(req)

        const company = await CompanyService.getCompanyById(companyId)
        if (!company) {
            return reply.status(404).send({
                success: false,
                message: 'Company not found',
            })
        }

        const isAdmin = role === 'admin'
        const isOwner = company.owner_id.toString() === userId

        if (!isAdmin && !isOwner) {
            return reply.status(403).send({
                success: false,
                message: 'You do not have permission to access this company extensions',
            })
        }

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
        const { role, id: userId } = getLoggedUser(req)

        const isAdmin = role === 'admin'

        if (!isAdmin) {
            const company = await CompanyService.getCompanyById(data.company_id)
            if (!company) {
                return reply.status(404).send({
                    success: false,
                    message: 'Company not found',
                })
            }

            const isOwner = company.owner_id.toString() === userId

            if (!isOwner) {
                return reply.status(403).send({
                    success: false,
                    message: 'You can only create extensions for your own companies',
                })
            }
        }

        const extension = await ExtensionService.createExtension(data, isAdmin)

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
        const { role, id: userId } = getLoggedUser(req)

        const isAdmin = role === 'admin'
        const existingExtension = await ExtensionService.getExtensionById(id)
        if (!existingExtension) {
            return reply.status(404).send({
                success: false,
                message: 'Extension not found'
            })
        }

        if (!isAdmin) {
            const company = await CompanyService.getCompanyById(existingExtension.company_id)
            const isOwner = company && company.owner_id.toString() === userId

            if (!isOwner) {
                return reply.status(403).send({
                    success: false,
                    message: 'You can only update extensions in your own companies',
                })
            }
        }

        await ExtensionService.updateExtension(id, data, isAdmin)

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
        const { role, id: userId } = getLoggedUser(req)

        const isAdmin = role === 'admin'
        const extension = await ExtensionService.getExtensionById(id)
        if (!extension) {
            return reply.status(404).send({
                success: false,
                message: 'Extension not found',
            })
        }

        if (!isAdmin) {
            const company = await CompanyService.getCompanyById(extension.company_id)
            const isOwner = company && company.owner_id.toString() === userId

            if (!isOwner) {
                return reply.status(403).send({
                    success: false,
                    message: 'You can only delete extensions in your own companies',
                })
            }
        }

        const deletedExtension = await ExtensionService.deleteExtension(id, isAdmin)
        if (!deletedExtension) return reply.status(404).send({
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
