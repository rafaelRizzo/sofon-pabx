import type { FastifyRequest, FastifyReply } from 'fastify'
import {
    createOfficeTimeSchema,
    updateOfficeTimeSchema,
    idParamSchema,
    getByCompanyParamSchema,
} from './schema/office_time.schema'
import * as OfficeTimeService from './office_time.service'
import { handleError } from '../../utils/handlers/handler.errors'
import { getLoggedUser } from '../../utils/handlers/handler.req.user'
import { AppError } from '../../utils/handlers/app.error'

export const getOfficeTimesByCompany = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { company_id } = getByCompanyParamSchema.parse(req.params)
        const { id: loggedUserId } = getLoggedUser(req)

        const member = await OfficeTimeService.isUserMemberOfCompany(loggedUserId, company_id)
        if (!member) throw new AppError('Forbidden', 403)

        const officeSchedules = await OfficeTimeService.getOfficeTimesByCompany(company_id)

        return reply.send({
            success: true,
            message: 'Office schedules fetched successfully',
            officeSchedules
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const getOfficeTimeById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const { id: loggedUserId } = getLoggedUser(req)

        const officeTime = await OfficeTimeService.getOfficeTimeById(id)
        if (!officeTime) throw new AppError('Office schedule not found', 404)

        const member = await OfficeTimeService.isUserMemberOfCompany(loggedUserId, officeTime.company_id)
        if (!member) throw new AppError('Forbidden', 403)

        return reply.send({
            success: true,
            message: 'Office schedule fetched successfully',
            officeTime
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const createOfficeTime = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createOfficeTimeSchema.parse(req.body)
        const { id: loggedUserId } = getLoggedUser(req)

        const member = await OfficeTimeService.isUserMemberOfCompany(loggedUserId, data.company_id)
        if (!member) throw new AppError('Forbidden', 403)

        const officeTime = await OfficeTimeService.createOfficeTime(data)
        if (!officeTime) throw new AppError('Failed to create office schedule', 500)

        return reply.status(201).send({
            success: true,
            message: 'Office schedule created successfully',
            office_time_id: officeTime.id
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const updateOfficeTime = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateOfficeTimeSchema.parse(req.body)
        const { id: loggedUserId } = getLoggedUser(req)

        const existing = await OfficeTimeService.getOfficeTimeById(id)
        if (!existing) throw new AppError('Office schedule not found', 404)

        const member = await OfficeTimeService.isUserMemberOfCompany(loggedUserId, existing.company_id)
        if (!member) throw new AppError('Forbidden', 403)

        await OfficeTimeService.updateOfficeTime(id, data)

        return reply.send({
            success: true,
            message: 'Office schedule updated successfully'
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const deleteOfficeTime = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const { id: loggedUserId } = getLoggedUser(req)

        const existing = await OfficeTimeService.getOfficeTimeById(id)
        if (!existing) throw new AppError('Office schedule not found', 404)

        const member = await OfficeTimeService.isUserMemberOfCompany(loggedUserId, existing.company_id)
        if (!member) throw new AppError('Forbidden', 403)

        await OfficeTimeService.deleteOfficeTime(id)

        return reply.send({
            success: true,
            message: 'Office schedule deleted successfully'
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const getOfficeTimeStatus = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const { id: loggedUserId } = getLoggedUser(req)

        const officeTime = await OfficeTimeService.getOfficeTimeById(id)
        if (!officeTime) throw new AppError('Office schedule not found', 404)

        const member = await OfficeTimeService.isUserMemberOfCompany(loggedUserId, officeTime.company_id)
        if (!member) throw new AppError('Forbidden', 403)

        const status = await OfficeTimeService.getOfficeTimeStatus(officeTime.company_id)

        return reply.send({
            success: true,
            message: 'Office status fetched successfully',
            status
        })
    } catch (error) {
        return handleError(reply, error)
    }
}