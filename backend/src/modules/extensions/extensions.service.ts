import { db } from '../../db/config/db'
import { eq } from 'drizzle-orm'
import { extensions } from '../../db/schemas/extensions'
import { companies } from '../../db/schemas/companies'
import { AppError } from '../../utils/handlers/app.error'
import { ExtensionsCache } from './cache/extensions.cache'

import type {
    CreateExtensionInput,
    UpdateExtensionInput,
} from './schemas/extension.schema'

const getCompanyOwner = async (company_id: bigint) => {
    const [company] = await db
        .select({ owner_id: companies.owner_id })
        .from(companies)
        .where(eq(companies.id, company_id))
    return company?.owner_id || null
}

const extensionSelect = {
    id: extensions.id,
    company_id: extensions.company_id,
    number: extensions.number,
    account_code: extensions.account_code,
    name: extensions.name,
    secret: extensions.secret,
    host: extensions.host,
    type: extensions.type,
    nat: extensions.nat,
    qualify: extensions.qualify,
    dtmfmode: extensions.dtmfmode,
    context: extensions.context,
    codecs: extensions.codecs,
    disallow: extensions.disallow,
    insecure: extensions.insecure,
    directmedia: extensions.directmedia,
    callgroup: extensions.callgroup,
    pickupgroup: extensions.pickupgroup,
    voicemail: extensions.voicemail,
    mailbox: extensions.mailbox,
    username: extensions.username,
    obs: extensions.obs,
    status: extensions.status,
    created_at: extensions.created_at,
    updated_at: extensions.updated_at,
}

export const getAllExtensions = async () => {
    const cached = await ExtensionsCache.getAllExtensions()
    if (cached) return cached

    const result = await db.select(extensionSelect).from(extensions)
    await ExtensionsCache.setAllExtensions(result)

    return result
}

export const getExtensionById = async (id: bigint) => {
    const cached = await ExtensionsCache.getExtension(id.toString())
    if (cached) return cached

    const [extension] = await db
        .select(extensionSelect)
        .from(extensions)
        .where(eq(extensions.id, id))

    if (extension) {
        await ExtensionsCache.setExtension(id.toString(), extension)
    }

    return extension ?? null
}

export const getCompanyExtensions = async (companyId: bigint) => {
    const cached = await ExtensionsCache.getCompanyExtensions(companyId.toString())
    if (cached) return cached

    const result = await db
        .select(extensionSelect)
        .from(extensions)
        .where(eq(extensions.company_id, companyId))

    await ExtensionsCache.setCompanyExtensions(companyId.toString(), result)

    return result
}

export const createExtension = async (data: CreateExtensionInput, isAdmin = false) => {
    const [company] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.id, data.company_id))

    if (!company) {
        throw new AppError('Company not found', 404)
    }

    const [existingExtension] = await db
        .select({ id: extensions.id })
        .from(extensions)
        .where(eq(extensions.account_code, data.account_code))

    if (existingExtension) {
        throw new AppError('Extension already exists', 409)
    }

    const [extension] = await db
        .insert(extensions)
        .values(data)
        .returning(extensionSelect)

    if (extension) {
        const ownerId = await getCompanyOwner(data.company_id)
        await ExtensionsCache.invalidateCompanyExtensions(data.company_id.toString())
        if (isAdmin) await ExtensionsCache.invalidateAllExtensions()
    }

    return extension
}

export const updateExtension = async (id: bigint, data: UpdateExtensionInput, isAdmin = false) => {
    const [existingExtension] = await db
        .select({ company_id: extensions.company_id })
        .from(extensions)
        .where(eq(extensions.id, id))

    if (!existingExtension) {
        throw new AppError('Extension not found', 404)
    }

    const updateData: Record<string, any> = {}
    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
            updateData[key] = value
        }
    })

    const [extension] = await db
        .update(extensions)
        .set(updateData)
        .where(eq(extensions.id, id))
        .returning(extensionSelect)

    if (extension) {
        await ExtensionsCache.invalidateExtension(id.toString())
        await ExtensionsCache.invalidateCompanyExtensions(extension.company_id.toString())
        if (isAdmin) await ExtensionsCache.invalidateAllExtensions()
    }

    return extension ?? null
}

export const deleteExtension = async (id: bigint, isAdmin = false) => {
    const extension = await getExtensionById(id)
    if (!extension) return null

    const [deletedExtension] = await db
        .delete(extensions)
        .where(eq(extensions.id, id))
        .returning(extensionSelect)

    if (deletedExtension) {
        await ExtensionsCache.invalidateExtension(id.toString())
        await ExtensionsCache.invalidateCompanyExtensions(extension.company_id.toString())
        if (isAdmin) await ExtensionsCache.invalidateAllExtensions()
    }

    return deletedExtension ?? null
}
