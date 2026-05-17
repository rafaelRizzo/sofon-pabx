import { db } from '../../db/config/db'
import { dids } from '../../db/schemas/dids'
import { companies } from '../../db/schemas/companies'
import { eq, and, inArray } from 'drizzle-orm'
import { AppError } from '../../utils/handlers/app.error'
import { DidsCache } from './cache/dids.cache'
import type { CreateDidInput, UpdateDidInput } from './schemas/dids.schema'

const getCompanyOwner = async (company_id: bigint) => {
    const [company] = await db
        .select({ owner_id: companies.owner_id })
        .from(companies)
        .where(eq(companies.id, company_id))
    return company?.owner_id || null
}

export const getAllDids = async () => {
    const cached = await DidsCache.getAllDids()
    if (cached) return cached

    const result = await db.select().from(dids).orderBy(dids.created_at)
    await DidsCache.setAllDids(result)

    return result
}

export const getDidsByCompanyId = async (company_id: bigint) => {
    const cached = await DidsCache.getDidsByCompany(company_id.toString())
    if (cached) return cached

    const result = await db
        .select()
        .from(dids)
        .where(eq(dids.company_id, company_id))
        .orderBy(dids.created_at)

    await DidsCache.setDidsByCompany(company_id.toString(), result)

    return result
}

export const getDidById = async (id: bigint) => {
    const cached = await DidsCache.getDid(id.toString())
    if (cached) return cached

    const result = await db
        .select()
        .from(dids)
        .where(eq(dids.id, id))
        .limit(1)

    const did = result[0] || null
    if (did) {
        await DidsCache.setDid(id.toString(), did)
    }

    return did
}

export const createDid = async (data: CreateDidInput, isAdmin = false) => {
    const existingDid = await db
        .select({ id: dids.id })
        .from(dids)
        .where(and(
            eq(dids.company_id, data.company_id),
            eq(dids.number, data.number)
        ))
        .limit(1)

    if (existingDid.length > 0) {
        throw new AppError('DID already exists for this company', 409)
    }

    const result = await db
        .insert(dids)
        .values({
            company_id: data.company_id,
            number: data.number,
            description: data.description,
        })
        .returning()

    const did = result[0]
    if (did) {
        const ownerId = await getCompanyOwner(data.company_id)
        await DidsCache.invalidateDidsByCompany(data.company_id.toString())
        if (ownerId) await DidsCache.invalidateDidsByOwner(ownerId.toString())
        if (isAdmin) await DidsCache.invalidateAllDids()
    }

    return did
}

export const updateDid = async (id: bigint, data: UpdateDidInput, isAdmin = false) => {
    const existingDid = await getDidById(id)
    if (!existingDid) {
        throw new AppError('DID not found', 404)
    }

    if (data.number && data.number !== existingDid.number) {
        const duplicateDid = await db
            .select({ id: dids.id })
            .from(dids)
            .where(and(
                eq(dids.company_id, existingDid.company_id),
                eq(dids.number, data.number)
            ))
            .limit(1)

        if (duplicateDid.length > 0) {
            throw new AppError('DID already exists for this company', 409)
        }
    }

    const updateData: Record<string, any> = {}

    if (data.number) updateData.number = data.number
    if (data.description !== undefined) updateData.description = data.description
    if (data.status) updateData.status = data.status

    const result = await db
        .update(dids)
        .set(updateData)
        .where(eq(dids.id, id))
        .returning()

    const did = result[0]
    if (did) {
        const ownerId = await getCompanyOwner(did.company_id)
        await DidsCache.invalidateDid(id.toString())
        await DidsCache.invalidateDidsByCompany(did.company_id.toString())
        if (ownerId) await DidsCache.invalidateDidsByOwner(ownerId.toString())
        if (isAdmin) await DidsCache.invalidateAllDids()
    }

    return did || null
}

export const deleteDid = async (id: bigint, isAdmin = false) => {
    const did = await getDidById(id)
    if (!did) return null

    const result = await db
        .delete(dids)
        .where(eq(dids.id, id))
        .returning()

    const deletedDid = result[0]
    if (deletedDid) {
        const ownerId = await getCompanyOwner(did.company_id)
        await DidsCache.invalidateDid(id.toString())
        await DidsCache.invalidateDidsByCompany(did.company_id.toString())
        if (ownerId) await DidsCache.invalidateDidsByOwner(ownerId.toString())
        if (isAdmin) await DidsCache.invalidateAllDids()
    }

    return deletedDid || null
}

export const getDidByIdAndCompanyId = async (id: bigint, company_id: bigint) => {
    const result = await db
        .select()
        .from(dids)
        .where(and(eq(dids.id, id), eq(dids.company_id, company_id)))
        .limit(1)

    return result[0] || null
}

export const getDidsByOwnerId = async (owner_id: bigint) => {
    const cached = await DidsCache.getDidsByOwner(owner_id.toString())
    if (cached) return cached

    const userCompanies = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.owner_id, owner_id))

    const companyIds = userCompanies.map(c => c.id)

    if (companyIds.length === 0) return []

    const result = await db
        .select()
        .from(dids)
        .where(inArray(dids.company_id, companyIds))
        .orderBy(dids.created_at)

    await DidsCache.setDidsByOwner(owner_id.toString(), result)

    return result
}
