import { db } from '../../db/config/db'
import { instances } from '../../db/schemas/instances'
import { companies } from '../../db/schemas/companies'
import { eq, and, inArray, ne } from 'drizzle-orm'
import { AppError } from '../../utils/handlers/app.error'
import { InstancesCache } from './cache/instances.cache'
import type { CreateInstanceInput, UpdateInstanceInput } from './schemas/instance.schema'

const getCompanyOwner = async (company_id: bigint) => {
    const [company] = await db
        .select({ owner_id: companies.owner_id })
        .from(companies)
        .where(eq(companies.id, company_id))
    return company?.owner_id || null
}

export const getAllInstances = async () => {
    const cached = await InstancesCache.getAllInstances()
    if (cached) return cached

    const result = await db.select().from(instances).orderBy(instances.created_at)
    await InstancesCache.setAllInstances(result)

    return result
}

export const getInstancesByCompanyId = async (company_id: bigint) => {
    const cached = await InstancesCache.getInstancesByCompany(company_id.toString())
    if (cached) return cached

    const result = await db
        .select()
        .from(instances)
        .where(eq(instances.company_id, company_id))
        .orderBy(instances.created_at)

    await InstancesCache.setInstancesByCompany(company_id.toString(), result)

    return result
}

export const getInstanceById = async (id: bigint) => {
    const cached = await InstancesCache.getInstance(id.toString())
    if (cached) return cached

    const result = await db
        .select()
        .from(instances)
        .where(eq(instances.id, id))
        .limit(1)

    const instance = result[0] || null
    if (instance) {
        await InstancesCache.setInstance(id.toString(), instance)
    }

    return instance
}

export const createInstance = async (data: CreateInstanceInput, isAdmin = false) => {
    const [existingInstance] = await db
        .select({ id: instances.id })
        .from(instances)
        .where(and(
            eq(instances.company_id, data.company_id),
            eq(instances.name, data.name)
        ))
        .limit(1)

    if (existingInstance) {
        throw new AppError('Instance with this name already exists in this company', 409)
    }

    const result = await db
        .insert(instances)
        .values({
            company_id: data.company_id,
            name: data.name,
            erp_type: data.erp_type,
            url: data.url,
            config: {},
        })
        .returning()

    const instance = result[0]
    if (instance) {
        const ownerId = await getCompanyOwner(data.company_id)
        await InstancesCache.invalidateInstancesByCompany(data.company_id.toString())
        if (ownerId) await InstancesCache.invalidateInstancesByOwner(ownerId.toString())
        if (isAdmin) await InstancesCache.invalidateAllInstances()
    }

    return instance
}

export const updateInstance = async (id: bigint, data: UpdateInstanceInput, isAdmin = false) => {
    const [existingInstance] = await db
        .select({ company_id: instances.company_id })
        .from(instances)
        .where(eq(instances.id, id))

    if (!existingInstance) {
        throw new AppError('Instance not found', 404)
    }

    if (data.name) {
        const [duplicateInstance] = await db
            .select({ id: instances.id })
            .from(instances)
            .where(and(
                eq(instances.company_id, existingInstance.company_id),
                eq(instances.name, data.name),
                ne(instances.id, id)
            ))
            .limit(1)

        if (duplicateInstance) {
            throw new AppError('Instance with this name already exists in this company', 409)
        }
    }

    const updateData: Record<string, any> = {}

    if (data.name) updateData.name = data.name
    if (data.url) updateData.url = data.url
    if (data.erp_type) updateData.erp_type = data.erp_type

    const result = await db
        .update(instances)
        .set(updateData)
        .where(eq(instances.id, id))
        .returning()

    const instance = result[0]
    if (instance) {
        const ownerId = await getCompanyOwner(instance.company_id)
        await InstancesCache.invalidateInstance(id.toString())
        await InstancesCache.invalidateInstancesByCompany(instance.company_id.toString())
        if (ownerId) await InstancesCache.invalidateInstancesByOwner(ownerId.toString())
        if (isAdmin) await InstancesCache.invalidateAllInstances()
    }

    return instance || null
}

export const deleteInstance = async (id: bigint, isAdmin = false) => {
    const instance = await getInstanceById(id)
    if (!instance) return null

    const result = await db
        .delete(instances)
        .where(eq(instances.id, id))
        .returning()

    const deletedInstance = result[0]
    if (deletedInstance) {
        const ownerId = await getCompanyOwner(instance.company_id)
        await InstancesCache.invalidateInstance(id.toString())
        await InstancesCache.invalidateInstancesByCompany(instance.company_id.toString())
        if (ownerId) await InstancesCache.invalidateInstancesByOwner(ownerId.toString())
        if (isAdmin) await InstancesCache.invalidateAllInstances()
    }

    return deletedInstance || null
}

export const getInstanceByIdAndCompanyId = async (id: bigint, company_id: bigint) => {
    const result = await db
        .select()
        .from(instances)
        .where(and(eq(instances.id, id), eq(instances.company_id, company_id)))
        .limit(1)

    return result[0] || null
}

export const getInstancesByOwnerId = async (owner_id: bigint) => {
    const cached = await InstancesCache.getInstancesByOwner(owner_id.toString())
    if (cached) return cached

    const userCompanies = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.owner_id, owner_id))

    const companyIds = userCompanies.map(c => c.id)

    if (companyIds.length === 0) return []

    const result = await db
        .select()
        .from(instances)
        .where(inArray(instances.company_id, companyIds))
        .orderBy(instances.created_at)

    await InstancesCache.setInstancesByOwner(owner_id.toString(), result)

    return result
}
