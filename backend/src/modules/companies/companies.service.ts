import { prisma } from '../../lib/prisma'
import { CompaniesCache } from './cache/companies.cache'
import type { CreateCompanyInput, UpdateCompanyInput } from './schemas/company.schema'
import { AppError } from '../../utils/errors/app.error'

export const getAllCompanies = async () => {
    const cached = await CompaniesCache.getAllCompanies()
    if (cached) return cached

    const companies = await prisma.company.findMany({
        select: {
            id: true,
            name: true,
            doc: true,
            metadata: true,
            createdAt: true,
            updatedAt: true,
        },
    })

    await CompaniesCache.setAllCompanies(companies)
    return companies
}

export const getCompanyById = async (id: string) => {
    const cached = await CompaniesCache.getCompany(id)
    if (cached) return cached

    const company = await prisma.company.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            doc: true,
            metadata: true,
            createdAt: true,
            updatedAt: true,
        },
    })

    if (!company) {
        throw new AppError('Company not found', 404)
    }

    await CompaniesCache.setCompany(id, company)
    return company
}

export const createCompany = async ({ userId, ...data }: Omit<CreateCompanyInput, 'userId'> & { userId: string }) => {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
        throw new AppError('User not found', 404)
    }

    const company = await prisma.$transaction(async (tx) => {
        const created = await tx.company.create({
            data,
            select: {
                id: true,
                name: true,
                doc: true,
                metadata: true,
                createdAt: true,
                updatedAt: true,
            },
        })

        await tx.userCompany.create({
            data: { userId, companyId: created.id },
        })

        return created
    })

    await CompaniesCache.invalidateAllCompanies()
    await CompaniesCache.invalidateCompaniesByUser(userId)
    return company
}

export const updateCompany = async (id: string, data: UpdateCompanyInput) => {
    const existing = await prisma.company.findUnique({
        where: { id },
        include: { users: { select: { userId: true } } },
    })
    if (!existing) {
        throw new AppError('Company not found', 404)
    }

    const company = await prisma.company.update({
        where: { id },
        data,
        select: {
            id: true,
            name: true,
            doc: true,
            metadata: true,
            createdAt: true,
            updatedAt: true,
        },
    })

    await CompaniesCache.invalidateCompany(id)
    await CompaniesCache.invalidateAllCompanies()
    await Promise.all(existing.users.map((u) => CompaniesCache.invalidateCompaniesByUser(u.userId)))
    return company
}

export const deleteCompany = async (id: string) => {
    const existing = await prisma.company.findUnique({
        where: { id },
        include: { users: { select: { userId: true } } },
    })
    if (!existing) {
        throw new AppError('Company not found', 404)
    }

    await prisma.company.delete({ where: { id } })

    await CompaniesCache.invalidateCompany(id)
    await CompaniesCache.invalidateAllCompanies()
    await Promise.all(existing.users.map((u) => CompaniesCache.invalidateCompaniesByUser(u.userId)))
}
