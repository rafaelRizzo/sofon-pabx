import { db } from '../../db/config/db'
import { eq, count } from 'drizzle-orm'
import { companies } from '../../db/schemas/companies'
import { AppError } from '../../utils/handlers/app.error'
import { CompaniesCache } from './cache/companies.cache'

import type {
    CreateCompanyInput,
    UpdateCompanyInput,
} from './schemas/company.schema'

const companySelect = {
    id: companies.id,
    name: companies.name,
    prefix: companies.prefix,
    description: companies.description,
    metadata: companies.metadata,
    status: companies.status,
    created_at: companies.created_at,
    updated_at: companies.updated_at,
}

export const getAllCompanies = async () => {
    const cached = await CompaniesCache.getAllCompanies()
    if (cached) return cached

    const result = await db.select(companySelect).from(companies)
    await CompaniesCache.setAllCompanies(result)

    return result
}

export const getCompanyById = async (id: string) => {
    const cached = await CompaniesCache.getCompany(id)
    if (cached) return cached

    const [company] = await db
        .select(companySelect)
        .from(companies)
        .where(eq(companies.id, id))

    if (company) {
        await CompaniesCache.setCompany(id, company)
    }

    return company ?? null
}

export const createCompany = async (data: CreateCompanyInput) => {
    const [existingCompany] = await db
        .select()
        .from(companies)
        .where(eq(companies.name, data.name))

    if (existingCompany) {
        throw new AppError('Company already exists', 409)
    }

    const result = await db.select({ count: count() }).from(companies)
    const companiesCount = Number(result[0]?.count ?? 0) + 1
    const prefix = String(companiesCount).padStart(3, '0')

    const [company] = await db
        .insert(companies)
        .values({
            name: data.name,
            prefix: prefix,
            description: data.description,
            metadata: data.metadata ?? {},
            status: 'guest',
        })
        .returning(companySelect)

    await CompaniesCache.invalidateAllCompanies()

    return company
}

export const updateCompany = async (id: string, data: UpdateCompanyInput) => {
    const [existingCompany] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, id))

    if (!existingCompany) {
        throw new AppError('Company not found', 404)
    }

    const updateData: any = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.metadata !== undefined) updateData.metadata = data.metadata
    if (data.status !== undefined) updateData.status = data.status

    const [company] = await db
        .update(companies)
        .set(updateData)
        .where(eq(companies.id, id))
        .returning(companySelect)

    await CompaniesCache.invalidateCompany(id)
    await CompaniesCache.invalidateAllCompanies()

    return company ?? null
}

export const deleteCompany = async (id: string) => {
    const [company] = await db
        .delete(companies)
        .where(eq(companies.id, id))
        .returning(companySelect)

    await CompaniesCache.invalidateCompany(id)
    await CompaniesCache.invalidateAllCompanies()

    return company ?? null
}
