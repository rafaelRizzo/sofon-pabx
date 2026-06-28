import { randomBytes } from 'crypto'
import { prisma } from '../../lib/prisma'
import { ExtensionsCache } from './cache/extensions.cache'
import type { CreateExtensionInput, UpdateExtensionInput } from './schemas/extension.schema'
import { sipFieldKeys, pjsipFieldKeys } from './schemas/extension.schema'
import { PjsipRepository } from '../../asterisk/pjsip.repository'
import { SipRepository } from '../../asterisk/sip.repository'
import { DialplanRepository } from '../../asterisk/dialplan.repository'
import { AsteriskQueueRepository } from '../../asterisk/queue.repository'
import { AppError } from '../../utils/errors/app.error'

const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const generatePassword = () => {
    const bytes = randomBytes(20)
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

        await prisma.$transaction(async (tx) => {
            await PjsipRepository.createExtension(tx, number, { password, name, context, extras: pjsipExtras })
            await DialplanRepository.create(tx, context, number, 'pjsip')
            await tx.extension.create({ data: { alias, number, type, name, context, companyId } })
        })
    } else {
        const { alias: _a, type: _t, name: _n, companyId: _c, context: _ctx, peerType, ...sipExtras } = data
        const sipData: Record<string, any> = { ...sipExtras }
        if (peerType) sipData.type = peerType

        await prisma.$transaction(async (tx) => {
            await SipRepository.createExtension(tx, number, password, context, sipData)
            await DialplanRepository.create(tx, context, number, 'sip')
            await tx.extension.create({ data: { alias, number, type, name, context, companyId } })
        })
    }

    await ExtensionsCache.invalidateAllExtensions()
    const created = await prisma.extension.findUnique({ where: { alias_companyId: { alias, companyId } }, select: { id: true } })
    const extension = await getExtensionById(created!.id)
    return { ...extension, password }
}

export const updateExtension = async (id: string, data: UpdateExtensionInput) => {
    const existing = await prisma.extension.findUnique({
        where: { id },
        include: { company: { select: { asteriskId: true } } },
    })
    if (!existing) throw new AppError('Extension not found', 404)

    const { alias, number, type, context, companyId } = existing
    const { name, alias: newAlias, context: newContext, ...typeFields } = data

    const aliasChanged = newAlias !== undefined && newAlias !== alias
    const contextChanged = newContext !== undefined && newContext !== context
    const effectiveNumber = aliasChanged ? generateAsteriskNumber(newAlias, existing.company.asteriskId) : number
    const effectiveContext = newContext ?? context

    if (aliasChanged) {
        const conflict = await prisma.extension.findUnique({
            where: { alias_companyId: { alias: newAlias, companyId } },
        })
        if (conflict) throw new AppError('Extension alias already in use for this company', 409)
    }

    await prisma.$transaction(async (tx) => {
        if (aliasChanged || contextChanged) {
            await DialplanRepository.recreate(tx, context, number, effectiveContext, effectiveNumber, type as 'sip' | 'pjsip')
        }

        if (type === 'pjsip') {
            if (aliasChanged) {
                await PjsipRepository.renameExtension(tx, number, effectiveNumber)
                await AsteriskQueueRepository.updateMemberInterfaces(tx, `PJSIP/${number}`, `PJSIP/${effectiveNumber}`)
            }

            const endpointUpdate: Record<string, any> = {}
            const aorUpdate: Record<string, any> = {}

            if (name !== undefined) endpointUpdate.callerid = `${name} <${effectiveNumber}>`
            if (contextChanged) endpointUpdate.context = effectiveContext

            for (const key of pjsipFieldKeys) {
                const value = (typeFields as any)[key]
                if (value === undefined) continue
                if (key.startsWith('aor_')) aorUpdate[key.slice(4)] = value
                else endpointUpdate[key] = value
            }

            await PjsipRepository.updateExtension(tx, effectiveNumber, endpointUpdate, aorUpdate)
        } else {
            if (aliasChanged) {
                await SipRepository.renameExtension(tx, number, effectiveNumber)
                await AsteriskQueueRepository.updateMemberInterfaces(tx, `SIP/${number}`, `SIP/${effectiveNumber}`)
            }

            const sipUpdate: Record<string, any> = {}
            if (contextChanged) sipUpdate.context = effectiveContext

            for (const key of sipFieldKeys) {
                const value = (typeFields as any)[key]
                if (value !== undefined) sipUpdate[key] = value
            }

            await SipRepository.updateExtension(tx, effectiveNumber, sipUpdate)
        }

        const extUpdate: Record<string, any> = {}
        if (name !== undefined) extUpdate.name = name
        if (aliasChanged) { extUpdate.alias = newAlias; extUpdate.number = effectiveNumber }
        if (contextChanged) extUpdate.context = effectiveContext

        if (Object.keys(extUpdate).length > 0)
            await tx.extension.update({ where: { id }, data: extUpdate })
    })

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

    await prisma.$transaction(async (tx) => {
        await AsteriskQueueRepository.removeMembersByInterfaces(tx, [asteriskInterface])
        await DialplanRepository.delete(tx, context, number)

        if (type === 'pjsip') {
            await PjsipRepository.deleteExtension(tx, number)
        } else {
            await SipRepository.deleteExtension(tx, number)
        }

        await tx.extension.delete({ where: { id } })
    })

    await ExtensionsCache.invalidateExtension(id)
    await ExtensionsCache.invalidateAllExtensions()
    return { id, alias, companyId }
}
