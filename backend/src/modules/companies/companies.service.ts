import { prisma } from '../../lib/prisma'
import { CompaniesCache } from './cache/companies.cache'
import type { CreateCompanyInput, UpdateCompanyInput } from './schemas/company.schema'
import { AppError } from '../../utils/errors/app.error'

export const getAllCompanies = async (companyIds?: string[]) => {
    if (companyIds && companyIds.length === 0) return []

    if (!companyIds) {
        const cached = await CompaniesCache.getAllCompanies()
        if (cached) return cached
    }

    const companies = await prisma.company.findMany({
        where: companyIds ? { id: { in: companyIds } } : undefined,
        select: {
            id: true,
            name: true,
            doc: true,
            asteriskId: true,
            metadata: true,
            createdAt: true,
            updatedAt: true,
        },
    })

    if (!companyIds) await CompaniesCache.setAllCompanies(companies)
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
            asteriskId: true,
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
            asteriskId: true,
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
        select: { id: true, asteriskId: true, users: { select: { userId: true } } },
    })
    if (!existing) {
        throw new AppError('Company not found', 404)
    }

    const [extensions, queues] = await Promise.all([
        prisma.extension.findMany({
            where: { companyId: id },
            select: { number: true, context: true, type: true },
        }),
        prisma.queue.findMany({
            where: { companyId: id },
            select: { name: true },
        }),
    ])

    const numbers = extensions.map((e) => e.number)
    const pjsipNumbers = extensions.filter((e) => e.type === 'pjsip').map((e) => e.number)
    const sipNumbers = extensions.filter((e) => e.type === 'sip').map((e) => e.number)
    const asteriskInterfaces = extensions.map((e) => `${e.type.toUpperCase()}/${e.number}`)
    const asteriskQueueNames = queues.map((q) => `${existing.asteriskId}-${q.name}`)

    await prisma.$transaction([
        prisma.queue_members.deleteMany({ where: { interface: { in: asteriskInterfaces } } }),
        prisma.queues.deleteMany({ where: { name: { in: asteriskQueueNames } } }),
        prisma.extensions.deleteMany({ where: { exten: { in: numbers } } }),
        prisma.ps_endpoints.deleteMany({ where: { id: { in: pjsipNumbers } } }),
        prisma.ps_auths.deleteMany({ where: { id: { in: pjsipNumbers } } }),
        prisma.ps_aors.deleteMany({ where: { id: { in: pjsipNumbers } } }),
        prisma.sip_peers.deleteMany({ where: { name: { in: sipNumbers } } }),
        prisma.extension.deleteMany({ where: { companyId: id } }),
        prisma.company.delete({ where: { id } }),
    ])

    await CompaniesCache.invalidateCompany(id)
    await CompaniesCache.invalidateAllCompanies()
    await Promise.all(existing.users.map((u) => CompaniesCache.invalidateCompaniesByUser(u.userId)))
}
