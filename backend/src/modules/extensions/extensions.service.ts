import { db } from '../../db/config/db'
import { eq } from 'drizzle-orm'
import { extensions } from '../../db/schemas/extensions'
import { companies } from '../../db/schemas/companies'
import { AppError } from '../../utils/handlers/app.error'
import { TransactionHelper } from '../../utils/db/transaction.helper'
import { ExtensionsCache } from './cache/extensions.cache'

import type {
    CreateExtensionInput,
    UpdateExtensionInput,
} from './schemas/extension.schema'

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

export const createExtension = async (data: CreateExtensionInput) => {
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

    await TransactionHelper.execute(
        async () => extension,
        [
            { namespace: 'extensions:company', pattern: data.company_id.toString() },
            { namespace: 'extensions:all', pattern: 'list' },
        ]
    )

    return extension
}

export const updateExtension = async (id: bigint, data: UpdateExtensionInput) => {
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

    await TransactionHelper.execute(
        async () => extension,
        [
            { namespace: 'extensions:ext', pattern: id.toString() },
            { namespace: 'extensions:company', pattern: existingExtension.company_id.toString() },
            { namespace: 'extensions:all', pattern: 'list' },
        ]
    )

    return extension ?? null
}

export const deleteExtension = async (id: bigint) => {
    const [extension] = await db
        .delete(extensions)
        .where(eq(extensions.id, id))
        .returning(extensionSelect)

    if (extension) {
        await TransactionHelper.execute(
            async () => extension,
            [
                { namespace: 'extensions:ext', pattern: id.toString() },
                { namespace: 'extensions:company', pattern: extension.company_id.toString() },
                { namespace: 'extensions:all', pattern: 'list' },
            ]
        )
    }

    return extension ?? null
}
