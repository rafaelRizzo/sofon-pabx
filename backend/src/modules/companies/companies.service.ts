import { db } from '../../db/config/db'
import { eq, and, ne } from 'drizzle-orm'
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
    owner_id: companies.owner_id,
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

export const getCompanyById = async (id: bigint) => {
    const cached = await CompaniesCache.getCompany(id.toString())
    if (cached) return cached

    const [company] = await db
        .select(companySelect)
        .from(companies)
        .where(eq(companies.id, id))

    if (company) {
        await CompaniesCache.setCompany(id.toString(), company)
    }

    return company ?? null
}

export const getCompaniesByOwnerId = async (owner_id: bigint) => {
    const cached = await CompaniesCache.getCompaniesByOwner(owner_id.toString())
    if (cached) return cached

    const result = await db
        .select(companySelect)
        .from(companies)
        .where(eq(companies.owner_id, owner_id))

    await CompaniesCache.setCompaniesByOwner(owner_id.toString(), result)

    return result
}

export const createCompany = async (data: CreateCompanyInput & { createdByAdmin?: boolean }) => {
    const [existingCompany] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(and(
            eq(companies.owner_id, data.owner_id),
            eq(companies.name, data.name)
        ))

    if (existingCompany) {
        throw new AppError('You already have a company with this name', 409)
    }

    const prefix = generateCompanyPrefix()

    const [company] = await db
        .insert(companies)
        .values({
            owner_id: data.owner_id,
            name: data.name,
            prefix: prefix,
            description: data.description,
            obs: data.obs,
            status: 'guest',
        })
        .returning(companySelect)

    await CompaniesCache.invalidateCompaniesByOwner(data.owner_id.toString())
    if (data.createdByAdmin) {
        await CompaniesCache.invalidateAllCompanies()
    }

    return company
}

export const updateCompany = async (id: bigint, data: UpdateCompanyInput, isAdmin = false) => {
    const [existingCompany] = await db
        .select({ id: companies.id, owner_id: companies.owner_id, name: companies.name })
        .from(companies)
        .where(eq(companies.id, id))

    if (!existingCompany) {
        throw new AppError('Company not found', 404)
    }

    if (data.name && data.name !== existingCompany.name) {
        const [duplicateCompany] = await db
            .select({ id: companies.id })
            .from(companies)
            .where(and(
                eq(companies.owner_id, existingCompany.owner_id),
                eq(companies.name, data.name),
                ne(companies.id, id)
            ))

        if (duplicateCompany) {
            throw new AppError('You already have a company with this name', 409)
        }
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

    await CompaniesCache.invalidateCompany(id.toString())
    await CompaniesCache.invalidateCompaniesByOwner(existingCompany.owner_id.toString())
    if (isAdmin) {
        await CompaniesCache.invalidateAllCompanies()
    }

    return company ?? null
}

export const deleteCompany = async (id: bigint, isAdmin = false) => {
    const company = await getCompanyById(id)
    if (!company) return null

    const [deletedCompany] = await db
        .delete(companies)
        .where(eq(companies.id, id))
        .returning(companySelect)

    if (deletedCompany) {
        await CompaniesCache.invalidateCompany(id.toString())
        await CompaniesCache.invalidateCompaniesByOwner(company.owner_id.toString())
        if (isAdmin) {
            await CompaniesCache.invalidateAllCompanies()
        }
    }

    return deletedCompany ?? null
}
