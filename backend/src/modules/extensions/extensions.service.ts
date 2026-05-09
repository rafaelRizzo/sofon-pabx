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

export const getExtensionById = async (id: string) => {
    const cached = await ExtensionsCache.getExtension(id)
    if (cached) return cached

    const [extension] = await db
        .select(extensionSelect)
        .from(extensions)
        .where(eq(extensions.id, id))

    if (extension) {
        await ExtensionsCache.setExtension(id, extension)
    }

    return extension ?? null
}

export const getCompanyExtensions = async (companyId: string) => {
    const cached = await ExtensionsCache.getCompanyExtensions(companyId)
    if (cached) return cached

    const result = await db
        .select(extensionSelect)
        .from(extensions)
        .where(eq(extensions.company_id, companyId))

    await ExtensionsCache.setCompanyExtensions(companyId, result)

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
            { namespace: 'extensions', pattern: `company:${data.company_id}` },
            { namespace: 'extensions' }
        ]
    )

    return extension
}

export const updateExtension = async (id: string, data: UpdateExtensionInput) => {
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
            { namespace: 'extensions', pattern: id },
            { namespace: 'extensions', pattern: `company:${existingExtension.company_id}` },
            { namespace: 'extensions' }
        ]
    )

    return extension ?? null
}

export const deleteExtension = async (id: string) => {
    const [extension] = await db
        .delete(extensions)
        .where(eq(extensions.id, id))
        .returning(extensionSelect)

    if (extension) {
        await TransactionHelper.execute(
            async () => extension,
            [
                { namespace: 'extensions', pattern: id },
                { namespace: 'extensions', pattern: `company:${extension.company_id}` },
                { namespace: 'extensions' }
            ]
        )
    }

    return extension ?? null
}
