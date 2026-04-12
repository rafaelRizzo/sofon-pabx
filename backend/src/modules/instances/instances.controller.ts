import type { FastifyRequest, FastifyReply } from 'fastify'
import * as InstanceService from './instances.service'
import {
    idParamSchema,
    createInstanceSchema,
    updateInstanceSchema,
    companyParamSchema,
} from './schema/instances.schema'
import { handleError } from '../../utils/handlers/handler.errors'
import { getLoggedUser } from '../../utils/handlers/handler.req.user'
import { requireAdmin } from '../../utils/handlers/handler.permissions'
import { AppError } from '../../utils/handlers/app.error'

export const getInstances = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { role } = getLoggedUser(req)
        requireAdmin(role)
        const instances = await InstanceService.getAllInstances()
        return reply.send({
            success: true,
            message: 'Instances fetched successfully',
            instances
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const getInstancesByCompany = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { company_id } = companyParamSchema.parse(req.params)
        const { id: loggedUserId } = getLoggedUser(req)

        const member = await InstanceService.isUserMemberOfCompany(loggedUserId, company_id)
        if (!member) throw new AppError('Forbidden', 403)

        const instances = await InstanceService.getInstancesByCompany(company_id)
        return reply.send({
            success: true,
            message: 'Instances fetched successfully',
            instances
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const getInstanceById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const { id: loggedUserId } = getLoggedUser(req)

        const instance = await InstanceService.getInstanceById(id)
        if (!instance) throw new AppError('Instance not found', 404)

        const member = await InstanceService.isUserMemberOfCompany(loggedUserId, instance.company_id)
        if (!member) throw new AppError('Forbidden', 403)

        return reply.send({
            success: true,
            message: 'Instance fetched successfully',
            instance
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const createInstance = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createInstanceSchema.parse(req.body)
        const { id: loggedUserId } = getLoggedUser(req)

        const member = await InstanceService.isUserMemberOfCompany(loggedUserId, data.company_id)
        if (!member) throw new AppError('Forbidden', 403)

        const instance = await InstanceService.createInstance(data)
        if (!instance) throw new AppError('Failed to create instance', 500)

        return reply.status(201).send({
            success: true,
            message: 'Instance created successfully',
            instance_id: instance.id
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const updateInstance = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateInstanceSchema.parse(req.body)
        const { id: loggedUserId } = getLoggedUser(req)

        const existing = await InstanceService.getInstanceById(id)
        if (!existing) throw new AppError('Instance not found', 404)

        const member = await InstanceService.isUserMemberOfCompany(loggedUserId, existing.company_id)
        if (!member) throw new AppError('Forbidden', 403)

        await InstanceService.updateInstance(id, data)
        return reply.send({
            success: true,
            message: 'Instance updated successfully'
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const deleteInstance = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const { role } = getLoggedUser(req)
        requireAdmin(role)

        const instance = await InstanceService.deleteInstance(id)
        if (!instance) throw new AppError('Instance not found', 404)

        return reply.send({
            success: true,
            message: 'Instance deleted successfully'
        })
    } catch (error) {
        return handleError(reply, error)
    }
}