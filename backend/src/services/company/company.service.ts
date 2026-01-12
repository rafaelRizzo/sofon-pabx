import { prisma } from '../../lib/prisma'
import { AppError } from '../../utils/handler.error'

type CompanyType = {
    name: string
}

type UpdateCompanyType = {
    name?: string
}

// Select básico para listagem e criação
export const companySelect = {
    id: true,
    name: true,
    status: true,
    createdAt: true,
    updatedAt: true,
}

// Select com contagens para listagem
const companySelectWithCounts = {
    id: true,
    name: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    _count: {
        select: {
            announcements: true,
            apiRequests: true,
            audios: true,
            extensions: true,
            inboundRoutes: true,
            ivrs: true,
            ivrOptions: true,
            outboundRoutes: true,
            queues: true,
            setVariables: true,
            timeConditions: true,
            timeRules: true,
            trunks: true,
        }
    }
}

// Select detalhado com todos os relacionamentos para getById
const companySelectDetailed = {
    id: true,
    name: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    // Todos os relacionamentos completos
    announcements: true,
    apiRequests: true,
    audios: true,
    extensions: true,
    inboundRoutes: true,
    ivrs: true,
    ivrOptions: true,
    outboundRoutes: true,
    queues: true,
    setVariables: true,
    timeConditions: true,
    timeRules: true,
    trunks: true,
}

// Helper para transformar _count em relations
const transformCountToRelations = (company: any) => {
    const { _count, ...rest } = company
    return {
        ...rest,
        relations: _count
    }
}

export class CompanyService {

    async create(company: CompanyType) {
        const existingCompany = await prisma.company.findUnique({
            where: { name: company.name }
        })

        if (existingCompany) {
            throw new AppError('Já existe uma empresa com esse nome', 409)
        }

        return await prisma.company.create({
            data: { name: company.name },
            select: companySelect
        })
    }

    async list() {
        const companies = await prisma.company.findMany({
            select: companySelectWithCounts,
            orderBy: { name: 'asc' }
        })

        return companies.map(transformCountToRelations)
    }

    async getById(id: string) {
        const company = await prisma.company.findUnique({
            where: { id },
            select: companySelectDetailed
        })

        if (!company) {
            throw new AppError('Empresa não encontrada', 404)
        }

        return company
    }

    async update(id: string, data: UpdateCompanyType) {
        const existingCompany = await prisma.company.findUnique({
            where: { id }
        })

        if (!existingCompany) {
            throw new AppError('Empresa não encontrada', 404)
        }

        if (data.name && data.name !== existingCompany.name) {
            const duplicateName = await prisma.company.findUnique({
                where: { name: data.name }
            })

            if (duplicateName) {
                throw new AppError('Já existe uma empresa com esse nome', 409)
            }
        }

        return await prisma.company.update({
            where: { id },
            data,
            select: companySelect
        })
    }

    async delete(id: string) {
        const company = await prisma.company.findUnique({
            where: { id }
        })

        if (!company) {
            throw new AppError('Empresa não encontrada', 404)
        }

        await prisma.company.delete({
            where: { id }
        })

        return { success: true, message: 'Empresa deletada com sucesso' }
    }
}