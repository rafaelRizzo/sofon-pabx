import { db } from '../../db/config/db'
import { eq, and } from 'drizzle-orm'
import { instances } from '../../db/schemas/instances'
import { userCompanies } from '../../db/schemas/user_companies'
import { AppError } from '../../utils/handlers/app.error'
import type { CreateInstanceInput, UpdateInstanceInput } from './schema/instances.schema'

const instanceSelect = {
    id: instances.id,
    name: instances.name,
    company_id: instances.company_id,
    type: instances.type,
    auth: instances.auth,
    config: instances.config,
    status: instances.status,
    created_at: instances.created_at,
    updated_at: instances.updated_at,
}

export const getAllInstances = async () => {
    return db.select(instanceSelect).from(instances)
}

export const getInstanceById = async (id: string) => {
    const [instance] = await db
        .select(instanceSelect)
        .from(instances)
        .where(eq(instances.id, id))
    return instance ?? null
}

export const getInstancesByCompany = async (companyId: string) => {
    return db
        .select(instanceSelect)
        .from(instances)
        .where(eq(instances.company_id, companyId))
}

export const isUserMemberOfCompany = async (userId: string, companyId: string) => {
    const [row] = await db
        .select({ role: userCompanies.role })
        .from(userCompanies)
        .where(
            and(
                eq(userCompanies.user_id, userId),
                eq(userCompanies.company_id, companyId)
            )
        )
    return row ?? null
}

export const createInstance = async (data: CreateInstanceInput) => {
    const [existingName] = await db
        .select()
        .from(instances)
        .where(eq(instances.name, data.name))

    if (existingName) throw new AppError('Instance name already exists', 409)

    const [instance] = await db
        .insert(instances)
        .values(data)
        .returning(instanceSelect)

    if (!instance) throw new AppError('Failed to create instance', 500)

    return instance
}

export const updateInstance = async (id: string, data: UpdateInstanceInput) => {
    const [existing] = await db
        .select()
        .from(instances)
        .where(eq(instances.id, id))

    if (!existing) throw new AppError('Instance not found', 404)

    const [instance] = await db
        .update(instances)
        .set(data)
        .where(eq(instances.id, id))
        .returning(instanceSelect)

    return instance ?? null
}

export const deleteInstance = async (id: string) => {
    const [existing] = await db
        .select()
        .from(instances)
        .where(eq(instances.id, id))

    if (!existing) throw new AppError('Instance not found', 404)

    const [instance] = await db
        .delete(instances)
        .where(eq(instances.id, id))
        .returning(instanceSelect)

    return instance ?? null
}