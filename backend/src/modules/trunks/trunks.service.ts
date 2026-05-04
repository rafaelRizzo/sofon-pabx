import { db } from '../../db/config/db'
import { eq } from 'drizzle-orm'
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
    allow: trunks.allow,
    disallow: trunks.disallow,
    insecure: trunks.insecure,
    nat: trunks.nat,
    qualify: trunks.qualify,
    directmedia: trunks.directmedia,
    send_register: trunks.send_register,
    register_string: trunks.register_string,
    outbound_proxy: trunks.outbound_proxy,
    codecs: trunks.codecs,
    metadata: trunks.metadata,
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

export const getTrunkById = async (id: string) => {
    const cached = await TrunksCache.getTrunk(id)
    if (cached) return cached

    const [trunk] = await db
        .select(trunkSelect)
        .from(trunks)
        .where(eq(trunks.id, id))

    if (trunk) {
        await TrunksCache.setTrunk(id, trunk)
    }

    return trunk ?? null
}

export const getCompanyTrunks = async (companyId: string) => {
    const cached = await TrunksCache.getCompanyTrunks(companyId)
    if (cached) return cached

    const result = await db
        .select(trunkSelect)
        .from(trunks)
        .where(eq(trunks.company_id, companyId))

    await TrunksCache.setCompanyTrunks(companyId, result)

    return result
}

export const createTrunk = async (data: CreateTrunkInput) => {
    const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, data.company_id))

    if (!company) {
        throw new AppError('Company not found', 404)
    }

    const [existingTrunk] = await db
        .select()
        .from(trunks)
        .where(eq(trunks.company_id, data.company_id))
        .where(eq(trunks.name, data.name))

    if (existingTrunk) {
        throw new AppError('Trunk with this name already exists in this company', 409)
    }

    const [trunk] = await db
        .insert(trunks)
        .values({
            company_id: data.company_id,
            name: data.name,
            type: data.type,
            host: data.host,
            port: data.port,
            username: data.username,
            password: data.password,
            fromuser: data.fromuser,
            fromdomain: data.fromdomain,
            context: data.context,
            allow: data.allow,
            disallow: data.disallow,
            insecure: data.insecure,
            nat: data.nat,
            qualify: data.qualify,
            directmedia: data.directmedia,
            send_register: data.send_register,
            register_string: data.register_string,
            outbound_proxy: data.outbound_proxy,
            codecs: data.codecs,
            metadata: data.metadata,
        })
        .returning(trunkSelect)

    await TrunksCache.invalidateCompanyTrunks(data.company_id)
    await TrunksCache.invalidateAllTrunks()

    return trunk
}

export const updateTrunk = async (id: string, data: UpdateTrunkInput) => {
    const [existingTrunk] = await db
        .select()
        .from(trunks)
        .where(eq(trunks.id, id))

    if (!existingTrunk) {
        throw new AppError('Trunk not found', 404)
    }

    const updateData: any = {}

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

    await TrunksCache.invalidateTrunk(id)
    await TrunksCache.invalidateCompanyTrunks(existingTrunk.company_id)
    await TrunksCache.invalidateAllTrunks()

    return trunk ?? null
}

export const deleteTrunk = async (id: string) => {
    const [trunk] = await db
        .delete(trunks)
        .where(eq(trunks.id, id))
        .returning(trunkSelect)

    if (trunk) {
        await TrunksCache.invalidateTrunk(id)
        await TrunksCache.invalidateCompanyTrunks(trunk.company_id)
        await TrunksCache.invalidateAllTrunks()
    }

    return trunk ?? null
}
