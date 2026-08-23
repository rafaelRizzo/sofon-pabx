import type { FastifyRequest, FastifyReply } from 'fastify'
import * as CompaniesService from './companies.service'
import { createCompanySchema, updateCompanySchema, idParamSchema, userIdParamSchema } from './schemas/company.schema'
import * as UsersService from '../users/users.service'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'

export const getAllCompanies = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const companies = await CompaniesService.getAllCompanies(req.scope.companyIds ?? undefined, req.user!.id)
        return reply.send({
            success: true,
            message: 'Companies fetched successfully',
            companies,
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getCompanyById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        req.scope.assertAccess(id)
        const company = await CompaniesService.getCompanyById(id)
        return reply.send({
            success: true,
            message: 'Company fetched successfully',
            company,
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createCompany = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createCompanySchema.parse(req.body)
        // vínculo user↔empresa não é mais escolhido aqui: a empresa nasce vinculada a quem
        // a criou (necessário pro escopo de reseller/user) e o resto do vínculo é gerenciado
        // exclusivamente pela tela de Usuários (POST/PUT /users aceita companyIds)
        const company = await CompaniesService.createCompany(data, req.user!.id)
        return reply.status(201).send({
            success: true,
            message: 'Company created successfully',
            companyId: company.id,
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateCompany = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateCompanySchema.parse(req.body)
        req.scope.assertAccess(id)

        await CompaniesService.updateCompany(id, data)
        return reply.send({
            success: true,
            message: 'Company updated successfully',
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const resyncDialplan = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        req.scope.assertAccess(id)
        const summary = await CompaniesService.resyncDialplan(id)
        return reply.send({
            success: true,
            message: 'Dialplan resynced successfully',
            ...summary,
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const resyncAllDialplans = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const summary = await CompaniesService.resyncAllCompaniesDialplan()
        return reply.send({
            success: true,
            message: `Dialplan resynced for ${summary.succeeded}/${summary.total} companies`,
            ...summary,
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getCompaniesByUser = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id_user } = userIdParamSchema.parse(req.params)

        if (!req.scope.isAdmin && req.user!.id !== id_user) {
            throw new AppError('Forbidden', 403)
        }

        const companies = await UsersService.getCompaniesByUser(id_user)
        return reply.send({
            success: true,
            message: 'Companies fetched successfully',
            companies,
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteCompany = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        req.scope.assertAccess(id)
        await CompaniesService.deleteCompany(id)
        return reply.send({
            success: true,
            message: 'Company deleted successfully',
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
