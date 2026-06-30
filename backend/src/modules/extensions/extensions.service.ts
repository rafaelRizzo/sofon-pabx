import { randomBytes } from 'crypto'
import { prisma } from '../../lib/prisma'
import { ExtensionsCache } from './cache/extensions.cache'
import type { CreateExtensionInput, UpdateExtensionInput } from './schemas/extension.schema'
import { sipFieldKeys, pjsipFieldKeys, sipFieldMap, pjsipFieldMap } from './schemas/extension.schema'
import { PjsipRepository } from '../../asterisk/pjsip.repository'
import { SipRepository } from '../../asterisk/sip.repository'
import { DialplanRepository } from '../../asterisk/dialplan.repository'
import { AsteriskQueueRepository } from '../../asterisk/queue.repository'
import { AppError } from '../../utils/errors/app.error'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

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

const GROUP_FIELDS = ['namedcallgroup', 'namedpickupgroup'] as const

function toSipDbFields(data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue
        result[sipFieldMap[key] ?? key] = value
    }
    return result
}

function toPjsipDbFields(data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue
        result[pjsipFieldMap[key] ?? key] = value
    }
    return result
}

function prefixGroups(groups: string, asteriskId: string): string {
    return groups.split(',').map((g) => `${asteriskId}-${g.trim()}`).join(',')
}

function applyGroupPrefixes(data: Record<string, any>, asteriskId: string): Record<string, any> {
    const result = { ...data }
    for (const field of GROUP_FIELDS) {
        if (typeof result[field] === 'string') {
            result[field] = prefixGroups(result[field], asteriskId)
        }
    }
    return result
}

async function checkAsteriskSync(number: string, type: string): Promise<boolean> {
    if (type === 'pjsip') {
        const r = await prisma.ps_endpoints.findUnique({ where: { id: number }, select: { id: true } })
        return !!r
    }
    const r = await prisma.sip_peers.findUnique({ where: { name: number }, select: { id: true } })
    return !!r
}

async function provisionMissingAsteriskRecord(
    tx: Tx,
    opts: { alias: string; number: string; type: string; name: string; context: string }
): Promise<string | null> {
    const { alias, number, type, name, context } = opts

    if (type === 'pjsip') {
        const exists = await tx.ps_endpoints.findUnique({ where: { id: number }, select: { id: true } })
        if (exists) return null
        const password = generatePassword()
        await PjsipRepository.createExtension(tx, number, { password, name, context, extras: {} })
        await DialplanRepository.create(tx, context, alias, number, 'pjsip')
        return password
    }

    const exists = await tx.sip_peers.findUnique({ where: { name: number }, select: { id: true } })
    if (exists) return null
    const password = generatePassword()
    await SipRepository.createExtension(tx, number, password, context, {})
    await DialplanRepository.create(tx, context, alias, number, 'sip')
    return password
}

export const getAllExtensions = async (companyIds?: string[]) => {
    const singleCompanyId = companyIds?.length === 1 ? companyIds[0] : null
    const isAll = companyIds === undefined

    type GroupedExtensions = { sip: any[]; pjsip: any[] }
    let grouped: GroupedExtensions | null = null

    if (singleCompanyId) grouped = (await ExtensionsCache.getByCompany(singleCompanyId)) as GroupedExtensions | null
    else if (isAll) grouped = (await ExtensionsCache.getAllExtensions()) as GroupedExtensions | null

    if (!grouped) {
        const extensions = await prisma.extension.findMany({
            where: companyIds ? { companyId: { in: companyIds } } : undefined,
            select: {
                id: true,
                alias: true,
                number: true,
                type: true,
                name: true,
                context: true,
                allowOutbound: true,
                companyId: true,
                createdAt: true,
            },
        })

        const mapped = extensions.map(({ number, allowOutbound, ...rest }) => ({ ...rest, allowOutbound, username: number }))
        grouped = {
            sip: mapped.filter((e) => e.type === 'sip'),
            pjsip: mapped.filter((e) => e.type === 'pjsip'),
        }

        if (singleCompanyId) await ExtensionsCache.setByCompany(singleCompanyId, grouped)
        else if (isAll) await ExtensionsCache.setAllExtensions(grouped)
    }

    const pjsipNumbers = grouped.pjsip.map((e: any) => e.username)
    const sipNumbers = grouped.sip.map((e: any) => e.username)

    const [pjsipSync, sipSync] = await Promise.all([
        pjsipNumbers.length > 0
            ? prisma.ps_endpoints.findMany({ where: { id: { in: pjsipNumbers } }, select: { id: true } })
            : [],
        sipNumbers.length > 0
            ? prisma.sip_peers.findMany({ where: { name: { in: sipNumbers } }, select: { name: true } })
            : [],
    ])

    const pjsipSynced = new Set(pjsipSync.map((e: any) => e.id))
    const sipSynced = new Set(sipSync.map((e: any) => e.name))

    return {
        sip: grouped.sip.map((e: any) => ({ ...e, synced: sipSynced.has(e.username) })),
        pjsip: grouped.pjsip.map((e: any) => ({ ...e, synced: pjsipSynced.has(e.username) })),
    }
}

const extensionSelect = {
    id: true,
    alias: true,
    number: true,
    type: true,
    name: true,
    context: true,
    allowOutbound: true,
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
    allowOutbound: boolean
    companyId: string
    createdAt: Date
}

export const getExtensionById = async (id: string): Promise<ExtensionDto & { synced: boolean }> => {
    const cached = await ExtensionsCache.getExtension<ExtensionDto>(id)

    let dto: ExtensionDto
    if (cached) {
        dto = cached
    } else {
        const extension = await prisma.extension.findUnique({
            where: { id },
            select: extensionSelect,
        })
        if (!extension) throw new AppError('Extension not found', 404)
        const { number, allowOutbound, ...rest } = extension
        dto = { ...rest, allowOutbound, username: number }
        await ExtensionsCache.setExtension(id, dto)
    }

    const synced = await checkAsteriskSync(dto.username, dto.type)
    return { ...dto, synced }
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

    const allowOutbound = data.allowOutbound !== false
    const allowOutboundSetvar = `ALLOW_OUTBOUND=${allowOutbound ? 1 : 0}`

    if (type === 'pjsip') {
        const { alias: _a, type: _t, name: _n, companyId: _c, context: _ctx, allowOutbound: _ao, ...pjsipExtras } = data
        const mappedExtras = toPjsipDbFields(pjsipExtras)
        const pjsipExtrasWithGroups = applyGroupPrefixes({ ...mappedExtras, setvar: allowOutboundSetvar }, company.asteriskId)

        await prisma.$transaction(async (tx) => {
            await PjsipRepository.createExtension(tx, number, { password, name, context, extras: pjsipExtrasWithGroups })
            await DialplanRepository.create(tx, context, alias, number, 'pjsip')
            await tx.extension.create({ data: { alias, number, type, name, context, allowOutbound, companyId } })
        })
    } else {
        const { alias: _a, type: _t, name: _n, companyId: _c, context: _ctx, allowOutbound: _ao, peerType, ...sipExtras } = data
        const sipData: Record<string, any> = toSipDbFields(sipExtras)
        if (peerType) sipData.type = peerType
        sipData.setvar = sipData.setvar ? `${allowOutboundSetvar}\n${sipData.setvar}` : allowOutboundSetvar

        await prisma.$transaction(async (tx) => {
            await SipRepository.createExtension(tx, number, password, context, sipData)
            await DialplanRepository.create(tx, context, alias, number, 'sip')
            await tx.extension.create({ data: { alias, number, type, name, context, allowOutbound, companyId } })
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
    const { name, alias: newAlias, context: newContext, allowOutbound: newAllowOutbound, ...typeFields } = data

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

    let provisionedPassword: string | null = null

    await prisma.$transaction(async (tx) => {
        provisionedPassword = await provisionMissingAsteriskRecord(tx, {
            alias,
            number,
            type,
            name: existing.name,
            context,
        })

        if (aliasChanged || contextChanged) {
            const effectiveAlias = newAlias ?? alias
            await DialplanRepository.recreate(tx, alias, context, effectiveContext, effectiveAlias, effectiveNumber, type as 'sip' | 'pjsip')
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
            if (newAllowOutbound !== undefined) endpointUpdate.setvar = `ALLOW_OUTBOUND=${newAllowOutbound ? 1 : 0}`

            for (const key of pjsipFieldKeys) {
                const value = (typeFields as any)[key]
                if (value === undefined) continue
                const dbKey = pjsipFieldMap[key] ?? key
                if (dbKey.startsWith('aor_')) aorUpdate[dbKey.slice(4)] = value
                else endpointUpdate[dbKey] = value
            }

            const endpointUpdateWithGroups = applyGroupPrefixes(endpointUpdate, existing.company.asteriskId)
            await PjsipRepository.updateExtension(tx, effectiveNumber, endpointUpdateWithGroups, aorUpdate)
        } else {
            if (aliasChanged) {
                await SipRepository.renameExtension(tx, number, effectiveNumber)
                await AsteriskQueueRepository.updateMemberInterfaces(tx, `SIP/${number}`, `SIP/${effectiveNumber}`)
            }

            const sipUpdate: Record<string, any> = {}
            if (contextChanged) sipUpdate.context = effectiveContext
            if (newAllowOutbound !== undefined) sipUpdate.setvar = `ALLOW_OUTBOUND=${newAllowOutbound ? 1 : 0}`

            for (const key of sipFieldKeys) {
                const value = (typeFields as any)[key]
                if (value !== undefined) sipUpdate[sipFieldMap[key] ?? key] = value
            }

            await SipRepository.updateExtension(tx, effectiveNumber, sipUpdate)
        }

        const extUpdate: Record<string, any> = {}
        if (name !== undefined) extUpdate.name = name
        if (aliasChanged) { extUpdate.alias = newAlias; extUpdate.number = effectiveNumber }
        if (contextChanged) extUpdate.context = effectiveContext
        if (newAllowOutbound !== undefined) extUpdate.allowOutbound = newAllowOutbound

        if (Object.keys(extUpdate).length > 0)
            await tx.extension.update({ where: { id }, data: extUpdate })
    })

    await ExtensionsCache.invalidateExtension(id)
    await ExtensionsCache.invalidateAllExtensions()
    const updated = await getExtensionById(id)
    return provisionedPassword ? { ...updated, provisioned: true, password: provisionedPassword } : updated
}

export const resetExtensionPassword = async (id: string) => {
    const existing = await prisma.extension.findUnique({ where: { id } })
    if (!existing) throw new AppError('Extension not found', 404)

    const { alias, number, type, name, context } = existing
    const password = generatePassword()

    await prisma.$transaction(async (tx) => {
        if (type === 'pjsip') {
            const exists = await tx.ps_endpoints.findUnique({ where: { id: number }, select: { id: true } })
            if (!exists) {
                await PjsipRepository.createExtension(tx, number, { password, name, context, extras: {} })
                await DialplanRepository.create(tx, context, alias, number, 'pjsip')
            } else {
                await tx.ps_auths.update({ where: { id: number }, data: { password } })
            }
        } else {
            const exists = await tx.sip_peers.findUnique({ where: { name: number }, select: { id: true } })
            if (!exists) {
                await SipRepository.createExtension(tx, number, password, context, {})
                await DialplanRepository.create(tx, context, alias, number, 'sip')
            } else {
                await tx.sip_peers.update({ where: { name: number }, data: { secret: password } })
            }
        }
    })

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
        await DialplanRepository.delete(tx, context, alias)

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
