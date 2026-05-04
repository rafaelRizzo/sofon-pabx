import type { FastifyRequest, FastifyReply } from 'fastify'
import { createCompanySchema, updateCompanySchema, idParamSchema } from './schemas/company.schema'
import * as CompanyService from './companies.service'
import { handleError } from '../../utils/handlers/handler.errors'

export const getCompanies = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const companies = await CompanyService.getAllCompanies()

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

        const company = await CompanyService.getCompanyById(id)
        if (!company) return reply.status(404).send({
            success: false,
            message: 'Company not found'
        })

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
        const company = await CompanyService.createCompany(data)

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

        const existingCompany = await CompanyService.getCompanyById(id)
        if (!existingCompany) {
            return reply.status(404).send({
                success: false,
                message: 'Company not found'
            })
        }

        await CompanyService.updateCompany(id, data)

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

        const company = await CompanyService.deleteCompany(id)
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
