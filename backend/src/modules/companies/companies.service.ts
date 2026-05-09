import { db } from '../../db/config/db'
import { eq } from 'drizzle-orm'
import { companies } from '../../db/schemas/companies'
import { AppError } from '../../utils/handlers/app.error'
import { TransactionHelper } from '../../utils/db/transaction.helper'
import { CompaniesCache } from './cache/companies.cache'
import { generateCompanyPrefix } from '../../utils/generators/prefix.generator'

import type {
    CreateCompanyInput,
    UpdateCompanyInput,
} from './schemas/company.schema'

const companySelect = {
    id: companies.id,
    name: companies.name,
    prefix: companies.prefix,
    description: companies.description,
    obs: companies.obs,
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
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.name, data.name))

    if (existingCompany) {
        throw new AppError('Company already exists', 409)
    }

    const prefix = generateCompanyPrefix()

    const [company] = await db
        .insert(companies)
        .values({
            name: data.name,
            prefix: prefix,
            description: data.description,
            obs: data.obs,
            status: 'guest',
        })
        .returning(companySelect)

    await TransactionHelper.execute(
        async () => company,
        [{ namespace: 'companies' }]
    )

    return company
}

export const updateCompany = async (id: string, data: UpdateCompanyInput) => {
    const [existingCompany] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.id, id))

    if (!existingCompany) {
        throw new AppError('Company not found', 404)
    }

    const updateData: Record<string, any> = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.obs !== undefined) updateData.obs = data.obs
    if (data.status !== undefined) updateData.status = data.status

    const [company] = await db
        .update(companies)
        .set(updateData)
        .where(eq(companies.id, id))
        .returning(companySelect)

    await TransactionHelper.execute(
        async () => company,
        [{ namespace: 'companies', pattern: id }, { namespace: 'companies' }]
    )

    return company ?? null
}

export const deleteCompany = async (id: string) => {
    const [company] = await db
        .delete(companies)
        .where(eq(companies.id, id))
        .returning(companySelect)

    await TransactionHelper.execute(
        async () => company,
        [{ namespace: 'companies', pattern: id }, { namespace: 'companies' }]
    )

    return company ?? null
}
