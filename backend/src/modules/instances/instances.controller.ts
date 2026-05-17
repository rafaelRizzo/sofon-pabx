import type { FastifyRequest, FastifyReply } from 'fastify'
import {
    createInstanceSchema,
    updateInstanceSchema,
    idParamSchema,
    companyIdParamSchema,
} from './schemas/instance.schema'
import * as InstanceService from './instances.service'
import * as CompanyService from '../companies/companies.service'
import { handleError } from '../../utils/handlers/handler.errors'
import { getLoggedUser } from '../../utils/handlers/handler.req.user'

export const getInstances = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { role, id: userId } = getLoggedUser(req)

        let instances
        if (role === 'admin') {
            instances = await InstanceService.getAllInstances()
        } else {
            instances = await InstanceService.getInstancesByOwnerId(BigInt(userId))
        }

        return reply.send({
            success: true,
            instances,
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getInstancesByCompany = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { company_id } = companyIdParamSchema.parse(req.params)
        const { role, id: userId } = getLoggedUser(req)

        const company = await CompanyService.getCompanyById(company_id)
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
                message: 'You do not have permission to access this company instances',
            })
        }

        const instances = await InstanceService.getInstancesByCompanyId(company_id)

        return reply.send({
            success: true,
            instances,
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getInstanceById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const { role, id: userId } = getLoggedUser(req)

        const instance = await InstanceService.getInstanceById(id)
        if (!instance)
            return reply.status(404).send({
                success: false,
                message: 'Instance not found',
            })

        const isAdmin = role === 'admin'
        const company = await CompanyService.getCompanyById(instance.company_id)
        const isOwner = company && company.owner_id.toString() === userId

        if (!isAdmin && !isOwner) {
            return reply.status(403).send({
                success: false,
                message: 'You do not have permission to access this instance',
            })
        }

        return reply.send({
            success: true,
            instance,
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createInstance = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createInstanceSchema.parse(req.body)
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
                    message: 'You can only create instances for your own companies',
                })
            }
        }

        const instance = await InstanceService.createInstance(data, isAdmin)

        if (!instance) {
            return reply.status(500).send({
                success: false,
                message: 'Failed to create instance',
            })
        }

        return reply.status(201).send({
            success: true,
            message: 'Instance created successfully',
            instance_id: instance.id,
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateInstance = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateInstanceSchema.parse(req.body)
        const { role, id: userId } = getLoggedUser(req)

        const isAdmin = role === 'admin'
        const existingInstance = await InstanceService.getInstanceById(id)
        if (!existingInstance) {
            return reply.status(404).send({
                success: false,
                message: 'Instance not found',
            })
        }

        if (!isAdmin) {
            const company = await CompanyService.getCompanyById(existingInstance.company_id)
            const isOwner = company && company.owner_id.toString() === userId

            if (!isOwner) {
                return reply.status(403).send({
                    success: false,
                    message: 'You can only update instances in your own companies',
                })
            }
        }

        await InstanceService.updateInstance(id, data, isAdmin)

        return reply.send({
            success: true,
            message: 'Instance updated successfully',
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteInstance = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const { role, id: userId } = getLoggedUser(req)

        const isAdmin = role === 'admin'
        const instance = await InstanceService.getInstanceById(id)
        if (!instance) {
            return reply.status(404).send({
                success: false,
                message: 'Instance not found',
            })
        }

        if (!isAdmin) {
            const company = await CompanyService.getCompanyById(instance.company_id)
            const isOwner = company && company.owner_id.toString() === userId

            if (!isOwner) {
                return reply.status(403).send({
                    success: false,
                    message: 'You can only delete instances in your own companies',
                })
            }
        }

        const deletedInstance = await InstanceService.deleteInstance(id, isAdmin)
        if (!deletedInstance)
            return reply.status(404).send({
                success: false,
                message: 'Instance not found',
            })

        return reply.send({
            success: true,
            message: 'Instance deleted successfully',
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
