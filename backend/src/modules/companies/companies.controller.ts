import type { FastifyRequest, FastifyReply } from 'fastify'
import { createCompanySchema, updateCompanySchema, idParamSchema } from './schemas/company.schema'
import * as CompanyService from './companies.service'
import { handleError } from '../../utils/handlers/handler.errors'
import { getLoggedUser } from '../../utils/handlers/handler.req.user'

export const getCompanies = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { role, id: userId } = getLoggedUser(req)

        let companies
        if (role === 'admin') {
            companies = await CompanyService.getAllCompanies()
        } else {
            companies = await CompanyService.getCompaniesByOwnerId(BigInt(userId))
        }

        return reply.send({
            success: true,
            companies
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getCompanyById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const { role, id: userId } = getLoggedUser(req)

        const company = await CompanyService.getCompanyById(id)
        if (!company) return reply.status(404).send({
            success: false,
            message: 'Company not found'
        })

        const isAdmin = role === 'admin'
        const isOwner = company.owner_id.toString() === userId

        if (!isAdmin && !isOwner) {
            return reply.status(403).send({
                success: false,
                message: 'You do not have permission to access this company'
            })
        }

        return reply.send({
            success: true,
            company
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createCompany = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createCompanySchema.parse(req.body)
        const { role, id: userId } = getLoggedUser(req)

        const ownerId = role === 'admin' && data.owner_id ? data.owner_id : BigInt(userId)

        const company = await CompanyService.createCompany({
            ...data,
            owner_id: ownerId,
            createdByAdmin: role === 'admin'
        })

        if (!company) {
            return reply.status(500).send({
                success: false,
                message: 'Failed to create company'
            })
        }

        return reply.status(201).send({
            success: true,
            message: 'Company created successfully',
            company_id: company.id
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateCompany = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateCompanySchema.parse(req.body)
        const { role, id: userId } = getLoggedUser(req)

        const existingCompany = await CompanyService.getCompanyById(id)
        if (!existingCompany) {
            return reply.status(404).send({
                success: false,
                message: 'Company not found'
            })
        }

        const isAdmin = role === 'admin'
        const isOwner = existingCompany.owner_id.toString() === userId

        if (!isAdmin && !isOwner) {
            return reply.status(403).send({
                success: false,
                message: 'You do not have permission to update this company'
            })
        }

        await CompanyService.updateCompany(id, data, isAdmin)

        return reply.send({
            success: true,
            message: 'Company updated successfully'
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteCompany = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const { role, id: userId } = getLoggedUser(req)

        const existingCompany = await CompanyService.getCompanyById(id)
        if (!existingCompany) {
            return reply.status(404).send({
                success: false,
                message: 'Company not found'
            })
        }

        const isAdmin = role === 'admin'
        const isOwner = existingCompany.owner_id.toString() === userId

        if (!isAdmin && !isOwner) {
            return reply.status(403).send({
                success: false,
                message: 'You do not have permission to delete this company'
            })
        }

        const company = await CompanyService.deleteCompany(id, isAdmin)
        if (!company) return reply.status(404).send({
            success: false,
            message: 'Company not found'
        })

        return reply.send({
            success: true,
            message: 'Company deleted successfully'
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
