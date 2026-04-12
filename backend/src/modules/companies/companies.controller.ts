import type { FastifyRequest, FastifyReply } from 'fastify'
import {
    createCompanySchema,
    updateCompanySchema,
    idParamSchema,
    addMemberSchema,
    removeMemberParamSchema,
} from './schema/company.schema'
import * as CompanyService from './companies.service'
import { handleError } from '../../utils/handlers/handler.errors'
import { getLoggedUser } from '../../utils/handlers/handler.req.user'
import { requireAdmin } from '../../utils/handlers/handler.permissions'
import { AppError } from '../../utils/handlers/app.error'

export const getCompanies = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { role } = getLoggedUser(req)
        requireAdmin(role)
        const companies = await CompanyService.getAllCompanies()
        return reply.send({
            success: true,
            message: 'Companies fetched successfully',
            companies
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const getCompanyById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const { role, id: loggedUserId } = getLoggedUser(req)

        const isMember = await CompanyService.isUserMemberOfCompany(loggedUserId, id)
        if (!isMember && role !== 'admin') throw new AppError('Forbidden', 403)

        const company = await CompanyService.getCompanyById(id)
        if (!company) throw new AppError('Company not found', 404)

        return reply.send({
            success: true,
            message: 'Company fetched successfully',
            company
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const getMyCompanies = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id: loggedUserId } = getLoggedUser(req)
        const companies = await CompanyService.getCompaniesByUserId(loggedUserId)
        return reply.send({
            success: true,
            message: 'Companies fetched successfully',
            companies
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const createCompany = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createCompanySchema.parse(req.body)
        const { id: loggedUserId } = getLoggedUser(req)
        const company = await CompanyService.createCompany(data, loggedUserId)
        if (!company) throw new AppError('Failed to create company', 500)
        return reply.status(201).send({
            success: true,
            message: 'Company created successfully',
            company_id: company.id
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const updateCompany = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateCompanySchema.parse(req.body)
        const { role, id: loggedUserId } = getLoggedUser(req)

        const userRole = await CompanyService.getUserRoleInCompany(loggedUserId, id)
        if (!userRole && role !== 'admin') throw new AppError('Forbidden', 403)

        if (role !== 'admin' && data.plan) {
            throw new AppError('Only admins can change the company plan', 403)
        }

        await CompanyService.updateCompany(id, data)
        return reply.send({
            success: true,
            message: 'Company updated successfully'
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const deleteCompany = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const { role } = getLoggedUser(req)
        requireAdmin(role)
        const company = await CompanyService.deleteCompany(id)
        if (!company) throw new AppError('Company not found', 404)
        return reply.send({
            success: true,
            message: 'Company deleted successfully'
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const addMember = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const { user_id, role: memberRole } = addMemberSchema.parse(req.body)
        const { role, id: loggedUserId } = getLoggedUser(req)

        const userRole = await CompanyService.getUserRoleInCompany(loggedUserId, id)
        if (userRole !== 'owner' && role !== 'admin') throw new AppError('Forbidden', 403)

        await CompanyService.addMember(id, user_id, memberRole)
        return reply.status(201).send({
            success: true,
            message: 'Member added successfully'
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const removeMember = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id, user_id } = removeMemberParamSchema.parse(req.params)
        const { role, id: loggedUserId } = getLoggedUser(req)

        const userRole = await CompanyService.getUserRoleInCompany(loggedUserId, id)
        if (userRole !== 'owner' && role !== 'admin') throw new AppError('Forbidden', 403)

        const removed = await CompanyService.removeMember(id, user_id)
        if (!removed) throw new AppError('Member not found', 404)
        return reply.send({
            success: true,
            message: 'Member removed successfully'
        })
    } catch (error) {
        return handleError(reply, error)
    }
}