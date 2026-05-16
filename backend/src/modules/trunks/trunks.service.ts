import { db } from '../../db/config/db'
import { and, eq } from 'drizzle-orm'
import { trunks } from '../../db/schemas/trunks'
import { companies } from '../../db/schemas/companies'
import { AppError } from '../../utils/handlers/app.error'
import { TrunksCache } from './cache/trunks.cache'

import type {
    CreateTrunkInput,
    UpdateTrunkInput,
} from './schemas/trunk.schema'

const trunkSelect = {
    id: trunks.id,
    company_id: trunks.company_id,
    name: trunks.name,
    type: trunks.type,
    host: trunks.host,
    port: trunks.port,
    username: trunks.username,
    password: trunks.password,
    fromuser: trunks.fromuser,
    fromdomain: trunks.fromdomain,
    context: trunks.context,
    disallow: trunks.disallow,
    insecure: trunks.insecure,
    nat: trunks.nat,
    qualify: trunks.qualify,
    directmedia: trunks.directmedia,
    send_register: trunks.send_register,
    register_string: trunks.register_string,
    outbound_proxy: trunks.outbound_proxy,
    codecs: trunks.codecs,
    obs: trunks.obs,
    status: trunks.status,
    created_at: trunks.created_at,
    updated_at: trunks.updated_at,
}

export const getAllTrunks = async () => {
    const cached = await TrunksCache.getAllTrunks()
    if (cached) return cached

    const result = await db.select(trunkSelect).from(trunks)
    await TrunksCache.setAllTrunks(result)

    return result
}

export const getTrunkById = async (id: bigint) => {
    const cached = await TrunksCache.getTrunk(id.toString())
    if (cached) return cached

    const [trunk] = await db
        .select(trunkSelect)
        .from(trunks)
        .where(eq(trunks.id, id))

    if (trunk) {
        await TrunksCache.setTrunk(id.toString(), trunk)
    }

    return trunk ?? null
}

export const getCompanyTrunks = async (companyId: bigint) => {
    const cached = await TrunksCache.getCompanyTrunks(companyId.toString())
    if (cached) return cached

    const result = await db
        .select(trunkSelect)
        .from(trunks)
        .where(eq(trunks.company_id, companyId))

    await TrunksCache.setCompanyTrunks(companyId.toString(), result)

    return result
}

export const createTrunk = async (data: CreateTrunkInput) => {
    const [company] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.id, data.company_id))

    if (!company) {
        throw new AppError('Company not found', 404)
    }

    const [existingTrunk] = await db
        .select({ id: trunks.id })
        .from(trunks)
        .where(and(
            eq(trunks.company_id, data.company_id),
            eq(trunks.name, data.name)
        ))

    if (existingTrunk) {
        throw new AppError('Trunk with this name already exists in this company', 409)
    }

    const [trunk] = await db
        .insert(trunks)
        .values(data)
        .returning(trunkSelect)

    await TrunksCache.invalidateCompanyTrunks(data.company_id.toString())
    await TrunksCache.invalidateAllTrunks()

    return trunk
}

export const updateTrunk = async (id: bigint, data: UpdateTrunkInput) => {
    const [existingTrunk] = await db
        .select({ company_id: trunks.company_id })
        .from(trunks)
        .where(eq(trunks.id, id))

    if (!existingTrunk) {
        throw new AppError('Trunk not found', 404)
    }

    const updateData: Record<string, any> = {}
    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
            updateData[key] = value
        }
    })

    const [trunk] = await db
        .update(trunks)
        .set(updateData)
        .where(eq(trunks.id, id))
        .returning(trunkSelect)

    await TrunksCache.invalidateTrunk(id.toString())
    await TrunksCache.invalidateCompanyTrunks(existingTrunk.company_id.toString())
    await TrunksCache.invalidateAllTrunks()

    return trunk ?? null
}

export const deleteTrunk = async (id: bigint) => {
    const [trunk] = await db
        .delete(trunks)
        .where(eq(trunks.id, id))
        .returning(trunkSelect)

    if (trunk) {
        await TrunksCache.invalidateTrunk(id.toString())
        await TrunksCache.invalidateCompanyTrunks(trunk.company_id.toString())
        await TrunksCache.invalidateAllTrunks()
    }

    return trunk ?? null
}
