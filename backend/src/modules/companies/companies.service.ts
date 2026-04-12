import { db } from '../../db/config/db'
import { eq, and } from 'drizzle-orm'
import { companies } from '../../db/schemas/companies'
import { userCompanies } from '../../db/schemas/user_companies'
import { AppError } from '../../utils/handlers/app.error'
import type {
    CreateCompanyInput,
    UpdateCompanyInput,
} from './schema/company.schema'

const companySelect = {
    id: companies.id,
    name: companies.name,
    cnpj: companies.cnpj,
    plan: companies.plan,
    status: companies.status,
    created_at: companies.created_at,
    updated_at: companies.updated_at,
}

export const getAllCompanies = async () => {
    return db.select(companySelect).from(companies)
}

export const getCompanyById = async (id: string) => {
    const [company] = await db
        .select(companySelect)
        .from(companies)
        .where(eq(companies.id, id))
    return company ?? null
}

export const getCompaniesByUserId = async (userId: string) => {
    return db
        .select({
            ...companySelect,
            role: userCompanies.role,
        })
        .from(companies)
        .innerJoin(userCompanies, eq(userCompanies.company_id, companies.id))
        .where(eq(userCompanies.user_id, userId))
}

export const getUserRoleInCompany = async (userId: string, companyId: string) => {
    const [row] = await db
        .select({ role: userCompanies.role })
        .from(userCompanies)
        .where(
            and(
                eq(userCompanies.user_id, userId),
                eq(userCompanies.company_id, companyId)
            )
        )
    return row?.role ?? null
}

export const isUserMemberOfCompany = async (userId: string, companyId: string) => {
    const role = await getUserRoleInCompany(userId, companyId)
    return role !== null
}

export const createCompany = async (data: CreateCompanyInput, ownerId: string) => {
    const [existing] = await db
        .select()
        .from(companies)
        .where(eq(companies.cnpj, data.cnpj))

    if (existing) throw new AppError('CNPJ already exists', 409)

    const [company] = await db
        .insert(companies)
        .values(data)
        .returning(companySelect)

    if (!company) throw new AppError('Failed to create company', 500)

    await db.insert(userCompanies).values({
        user_id: ownerId,
        company_id: company.id,
        role: 'owner',
    })

    return company
}

export const updateCompany = async (id: string, data: UpdateCompanyInput) => {
    const [existing] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, id))
    if (!existing) throw new AppError('Company not found', 404)

    const [company] = await db
        .update(companies)
        .set(data)
        .where(eq(companies.id, id))
        .returning(companySelect)
    return company ?? null
}

export const deleteCompany = async (id: string) => {
    const [company] = await db
        .delete(companies)
        .where(eq(companies.id, id))
        .returning(companySelect)
    return company ?? null
}

export const addMember = async (companyId: string, userId: string, role: 'owner' | 'admin') => {
    const [existing] = await db
        .select()
        .from(userCompanies)
        .where(
            and(
                eq(userCompanies.user_id, userId),
                eq(userCompanies.company_id, companyId)
            )
        )
    if (existing) throw new AppError('User is already a member of this company', 409)

    const [row] = await db
        .insert(userCompanies)
        .values({ user_id: userId, company_id: companyId, role })
        .returning()
    return row
}

export const removeMember = async (companyId: string, userId: string) => {
    const [row] = await db
        .delete(userCompanies)
        .where(
            and(
                eq(userCompanies.user_id, userId),
                eq(userCompanies.company_id, companyId)
            )
        )
        .returning()
    return row ?? null
}