import { randomBytes } from 'crypto'
import { prisma } from '../../lib/prisma'
import { ExtensionsCache } from './cache/extensions.cache'
import type { CreateExtensionInput, UpdateExtensionInput } from './schemas/extension.schema'
import { AppError } from '../../utils/errors/app.error'

const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const generatePassword = () => {
    const len = 20
    const bytes = randomBytes(len)
    return Array.from(bytes, (b) => CHARSET[b % CHARSET.length]).join('')
}

export type BatchResult = {
    created: Awaited<ReturnType<typeof createExtension>>[]
    errors: { index: number; alias: string; companyId: string; error: string }[]
    total: number
}

function generateAsteriskNumber(alias: string, asteriskId: string): string {
    return `${alias}_${asteriskId}`
}

export const getAllExtensions = async (companyIds?: string[]) => {
    const singleCompanyId = companyIds?.length === 1 ? companyIds[0] : null

    if (singleCompanyId) {
        const cached = await ExtensionsCache.getByCompany(singleCompanyId)
        if (cached) return cached
    }

    const extensions = await prisma.extension.findMany({
        where: companyIds ? { companyId: { in: companyIds } } : undefined,
        select: {
            id: true,
            alias: true,
            number: true,
            type: true,
            name: true,
            context: true,
            companyId: true,
            createdAt: true,
        },
    })

    const mapped = extensions.map(({ number, ...rest }) => ({ ...rest, username: number }))

    const grouped = {
        sip: mapped.filter((e) => e.type === 'sip'),
        pjsip: mapped.filter((e) => e.type === 'pjsip'),
    }

    if (singleCompanyId) await ExtensionsCache.setByCompany(singleCompanyId, grouped)
    return grouped
}

const extensionSelect = {
    id: true,
    alias: true,
    number: true,
    type: true,
    name: true,
    context: true,
    companyId: true,
    createdAt: true,
} as const

type ExtensionDto = {
    id: string
    alias: string
    username: string
    type: string
    name: string
    context: string
    companyId: string
    createdAt: Date
}

export const getExtensionById = async (id: string): Promise<ExtensionDto> => {
    const cached = await ExtensionsCache.getExtension<ExtensionDto>(id)
    if (cached) return cached

    const extension = await prisma.extension.findUnique({
        where: { id },
        select: extensionSelect,
    })

    if (!extension) throw new AppError('Extension not found', 404)

    const { number, ...rest } = extension
    const result: ExtensionDto = { ...rest, username: number }
    await ExtensionsCache.setExtension(id, result)
    return result
}

export const createExtension = async (data: CreateExtensionInput) => {
    const { alias, type, name, companyId, context } = data
    const password = generatePassword()

    const existing = await prisma.extension.findUnique({
        where: { alias_companyId: { alias, companyId } },
    })
    if (existing) throw new AppError('Extension already exists for this company', 409)

    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { asteriskId: true } })
    if (!company) throw new AppError('Company not found', 404)

    const number = generateAsteriskNumber(alias, company.asteriskId)

    const asteriskNumberExists = await prisma.ps_endpoints.findUnique({ where: { id: number } })
    if (asteriskNumberExists) throw new AppError('Asterisk number conflict, contact support', 409)

    if (type === 'pjsip') {
        const { alias: _a, type: _t, name: _n, companyId: _c, context: _ctx, ...pjsipExtras } = data

        const aorData: Record<string, any> = { id: number }
        const endpointData: Record<string, any> = {
            id: number,
            aors: number,
            auth: number,
            context,
            callerid: `${name} <${number}>`,
        }

        for (const [key, value] of Object.entries(pjsipExtras)) {
            if (value === undefined) continue
            if (key.startsWith('aor_')) aorData[key.slice(4)] = value
            else endpointData[key] = value
        }

        await prisma.$transaction([
            prisma.ps_aors.create({ data: aorData as any }),
            prisma.ps_auths.create({ data: { id: number, auth_type: 'userpass', username: number, password } }),
            prisma.ps_endpoints.create({ data: endpointData as any }),
            prisma.extensions.createMany({
                data: [
                    { context, exten: number, priority: 1, app: 'Dial', appdata: `PJSIP/${number},20` },
                    { context, exten: number, priority: 2, app: 'HangUp', appdata: null },
                ],
            }),
            prisma.extension.create({
                data: { alias, number, type, name, context, companyId },
            }),
        ])
    } else {
        const { alias: _a, type: _t, name: _n, companyId: _c, context: _ctx, peerType, ...sipExtras } = data

        const sipData: Record<string, any> = {
            name: number,
            secret: password,
            ...sipExtras,
            context,
        }
        if (peerType) sipData.type = peerType

        await prisma.$transaction(async (tx) => {
            await tx.sip_peers.create({ data: sipData as any })
            await tx.extensions.createMany({
                data: [
                    { context, exten: number, priority: 1, app: 'Dial', appdata: `SIP/${number},20` },
                    { context, exten: number, priority: 2, app: 'HangUp', appdata: null },
                ],
            })
            await tx.extension.create({
                data: { alias, number, type, name, context, companyId },
            })
        })
    }

    await ExtensionsCache.invalidateAllExtensions()
    const created = await prisma.extension.findUnique({ where: { alias_companyId: { alias, companyId } }, select: { id: true } })
    const extension = await getExtensionById(created!.id)
    return { ...extension, password }
}

export const updateExtension = async (id: string, data: UpdateExtensionInput) => {
    const existing = await prisma.extension.findUnique({ where: { id } })
    if (!existing) throw new AppError('Extension not found', 404)

    const { number, type } = existing

    if (type === 'pjsip') {
        await prisma.$transaction([
            prisma.ps_endpoints.update({ where: { id: number }, data: { callerid: `${data.name} <${number}>` } }),
            prisma.extension.update({ where: { id }, data: { name: data.name } }),
        ])
    } else {
        await prisma.extension.update({ where: { id }, data: { name: data.name } })
    }

    await ExtensionsCache.invalidateExtension(id)
    await ExtensionsCache.invalidateAllExtensions()
    return getExtensionById(id)
}

export const resetExtensionPassword = async (id: string) => {
    const existing = await prisma.extension.findUnique({ where: { id } })
    if (!existing) throw new AppError('Extension not found', 404)

    const { number, type } = existing
    const password = generatePassword()

    if (type === 'pjsip') {
        await prisma.ps_auths.update({ where: { id: number }, data: { password } })
    } else {
        await prisma.sip_peers.update({ where: { name: number }, data: { secret: password } })
    }

    await ExtensionsCache.invalidateExtension(id)
    return { password }
}

export const createExtensionBatch = async (items: CreateExtensionInput[]): Promise<BatchResult> => {
    const results = await Promise.allSettled(items.map((item) => createExtension(item)))

    const created: BatchResult['created'] = []
    const errors: BatchResult['errors'] = []

    results.forEach((r, i) => {
        const item = items[i]!
        if (r.status === 'fulfilled') {
            created.push(r.value)
        } else {
            errors.push({
                index: i,
                alias: item.alias,
                companyId: item.companyId,
                error: r.reason instanceof AppError ? r.reason.message : 'Internal error',
            })
        }
    })

    return { created, errors, total: items.length }
}

export const deleteExtension = async (id: string) => {
    const existing = await prisma.extension.findUnique({ where: { id } })
    if (!existing) throw new AppError('Extension not found', 404)

    const { alias, companyId, number, type, context } = existing
    const asteriskInterface = `${type.toUpperCase()}/${number}`

    if (type === 'pjsip') {
        await prisma.$transaction([
            prisma.queue_members.deleteMany({ where: { interface: asteriskInterface } }),
            prisma.extensions.deleteMany({ where: { context, exten: number } }),
            prisma.ps_endpoints.delete({ where: { id: number } }),
            prisma.ps_auths.delete({ where: { id: number } }),
            prisma.ps_aors.delete({ where: { id: number } }),
            prisma.extension.delete({ where: { id } }),
        ])
    } else {
        await prisma.$transaction([
            prisma.queue_members.deleteMany({ where: { interface: asteriskInterface } }),
            prisma.extensions.deleteMany({ where: { context, exten: number } }),
            prisma.sip_peers.delete({ where: { name: number } }),
            prisma.extension.delete({ where: { id } }),
        ])
    }

    await ExtensionsCache.invalidateExtension(id)
    await ExtensionsCache.invalidateAllExtensions()
    return { id, alias, companyId }
}
