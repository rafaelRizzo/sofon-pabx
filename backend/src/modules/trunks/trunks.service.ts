import { randomBytes } from 'crypto'
import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { TrunksCache } from './cache/trunks.cache'
import type { CreateTrunkInput, UpdateTrunkInput } from './schemas/trunk.schema'
import { PjsipRepository } from '../../asterisk/pjsip.repository'
import { IaxRepository } from '../../asterisk/iax.repository'
import { InboundRouteRepository, TRUNK_ENTRY_CONTEXT } from '../../asterisk/inboundroute.repository'
import { resyncAllPatterns } from '../outbound-routes/outbound-routes.service'
import { OutboundRoutesCache } from '../outbound-routes/cache/outbound-routes.cache'
import { AppError } from '../../utils/errors/app.error'

const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const generatePassword = () => {
    const bytes = randomBytes(20)
    return Array.from(bytes, (b) => CHARSET[b % CHARSET.length]).join('')
}

export const toAsteriskId = (asteriskId: string, name: string) => `${asteriskId}-trunk-${name}`

const trunkSelect = {
    id: true,
    name: true,
    companyId: true,
    type: true,
    registrationMode: true,
    identifyBy: true,
    host: true,
    port: true,
    username: true,
    password: true,
    context: true,
    codecs: true,
    techPrefix: true,
    maxInChannels: true,
    maxOutChannels: true,
    transport: true,
    dtmfMode: true,
    directMedia: true,
    qualifyFrequency: true,
    qualifyTimeout: true,
    outboundProxy: true,
    iceSupport: true,
    rel: true,
    timers: true,
    timersMinSe: true,
    timersSessExpires: true,
    sendDiversion: true,
    customHeaders: true,
    qualify: true,
    trunkMode: true,
    encryption: true,
    transfer: true,
    jitterbuffer: true,
    metadata: true,
    createdAt: true,
    updatedAt: true,
} as const

export const getTrunks = async (companyId: string) => {
    const cached = await TrunksCache.getByCompany(companyId)
    if (cached) return cached

    await getCompanyById(companyId)

    const trunks = await prisma.trunk.findMany({ where: { companyId }, select: trunkSelect })
    await TrunksCache.setByCompany(companyId, trunks)
    return trunks
}

export const getAllTrunks = async (companyIds?: string[], userId?: string) => {
    if (companyIds && companyIds.length === 0) return []

    if (!companyIds) {
        const cached = await TrunksCache.getAll()
        if (cached) return cached
    } else if (userId) {
        const cached = await TrunksCache.getForScope(userId)
        if (cached) return cached
    }

    const trunks = await prisma.trunk.findMany({
        where: companyIds ? { companyId: { in: companyIds } } : undefined,
        select: trunkSelect,
    })

    if (!companyIds) await TrunksCache.setAll(trunks)
    else if (userId) await TrunksCache.setForScope(userId, trunks)
    return trunks
}

const _byId = () => prisma.trunk.findUnique({ where: { id: '' }, select: trunkSelect })
export type TrunkDto = NonNullable<Awaited<ReturnType<typeof _byId>>>

export const getTrunkById = async (id: string): Promise<TrunkDto> => {
    const cached = await TrunksCache.getTrunk<TrunkDto>(id)
    if (cached) return cached

    const trunk = await prisma.trunk.findUnique({ where: { id }, select: trunkSelect })
    if (!trunk) throw new AppError('Trunk not found', 404)

    await TrunksCache.setTrunk(id, trunk)
    return trunk
}

export const createTrunk = async (data: CreateTrunkInput) => {
    const company = await getCompanyById(data.companyId)

    const existing = await prisma.trunk.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Trunk already exists for this company', 409)

    if (data.registrationMode === 'custom') {
        const created = await prisma.trunk.create({
            data: { name: data.name, companyId: data.companyId, registrationMode: 'custom', context: data.context },
        })
        const trunk = await prisma.trunk.findUnique({ where: { id: created.id }, select: trunkSelect })
        await TrunksCache.invalidateAllTrunks()
        await TrunksCache.setTrunk(created.id, trunk!)
        return trunk!
    }

    const astId = toAsteriskId(company.asteriskId, data.name)
    const identifyBy = data.registrationMode === 'inbound' ? (data.username ? 'username' : 'ip') : null
    const hasAuth = data.registrationMode === 'outbound' || identifyBy === 'username'
    const username = hasAuth ? (data.username ?? astId) : null
    const password = hasAuth ? (data.password ?? generatePassword()) : null

    await prisma.$transaction(async (tx) => {
        const created = await tx.trunk.create({
            data: {
                name: data.name,
                companyId: data.companyId,
                type: data.type,
                registrationMode: data.registrationMode,
                identifyBy,
                host: data.registrationMode === 'outbound' ? data.host : (data.host ?? null),
                port: data.port ?? null,
                username,
                password,
                codecs: data.codecs,
                techPrefix: data.techPrefix ?? null,
                maxInChannels: data.maxInChannels ?? null,
                maxOutChannels: data.maxOutChannels ?? null,
                transport: data.transport ?? null,
                dtmfMode: data.dtmfMode ?? null,
                directMedia: data.directMedia ?? null,
                qualifyFrequency: data.qualifyFrequency ?? null,
                qualifyTimeout: data.qualifyTimeout ?? null,
                outboundProxy: data.outboundProxy ?? null,
                iceSupport: data.iceSupport ?? null,
                rel: data.rel ?? null,
                timers: data.timers ?? null,
                timersMinSe: data.timersMinSe ?? null,
                timersSessExpires: data.timersSessExpires ?? null,
                sendDiversion: data.sendDiversion ?? null,
                customHeaders: data.type === 'pjsip' ? (data.customHeaders ?? []) : [],
                qualify: data.qualify ?? null,
                trunkMode: data.trunkMode ?? null,
                encryption: data.encryption ?? null,
                transfer: data.transfer ?? null,
                jitterbuffer: data.jitterbuffer ?? null,
            },
        })

        // contexto único (from-trunk) — TRUNKID via setvar isola o dialplan por trunk no from-trunk-routed
        await tx.trunk.update({ where: { id: created.id }, data: { context: TRUNK_ENTRY_CONTEXT } })

        if (data.type === 'iax') {
            await IaxRepository.createTrunk(tx, astId, {
                username: username ?? undefined,
                password: password ?? undefined,
                context: TRUNK_ENTRY_CONTEXT,
                codecs: data.codecs,
                registrationMode: data.registrationMode,
                identifyBy,
                host: data.host,
                setvar: `TRUNKID=${created.id}`,
                accountcode: company.asteriskId,
                qualify: data.qualify,
                trunkMode: data.trunkMode,
                encryption: data.encryption,
                transfer: data.transfer,
                jitterbuffer: data.jitterbuffer,
            })
        } else {
            await PjsipRepository.createTrunk(tx, astId, {
                username: username ?? undefined,
                password: password ?? undefined,
                context: TRUNK_ENTRY_CONTEXT,
                codecs: data.codecs,
                registrationMode: data.registrationMode,
                identifyBy,
                host: data.host,
                port: data.port,
                setvar: `TRUNKID=${created.id}`,
                accountcode: company.asteriskId,
                transport: data.transport,
                dtmfMode: data.dtmfMode,
                directMedia: data.directMedia,
                qualifyFrequency: data.qualifyFrequency,
                qualifyTimeout: data.qualifyTimeout,
                outboundProxy: data.outboundProxy,
                iceSupport: data.iceSupport,
                rel: data.rel,
                timers: data.timers,
                timersMinSe: data.timersMinSe,
                timersSessExpires: data.timersSessExpires,
                sendDiversion: data.sendDiversion,
            })
        }
    })

    const created = await prisma.trunk.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
        select: trunkSelect,
    })
    await TrunksCache.invalidateAllTrunks()
    await TrunksCache.setTrunk(created!.id, created!)
    return created!
}

export const updateTrunk = async (id: string, data: UpdateTrunkInput) => {
    const existing = await prisma.trunk.findUnique({
        where: { id },
        include: { company: { select: { asteriskId: true } } },
    })
    if (!existing) throw new AppError('Trunk not found', 404)

    if (data.context !== undefined && existing.registrationMode !== 'custom')
        throw new AppError('context só pode ser alterado em trunks custom', 400)

    if (existing.registrationMode === 'custom') {
        const contextChanged = data.context !== undefined && data.context !== existing.context
        await prisma.$transaction(async (tx) => {
            if (data.context !== undefined) await tx.trunk.update({ where: { id }, data: { context: data.context } })
            if (contextChanged) {
                const affectedRouteIds = (
                    await tx.outboundRouteTrunk.findMany({ where: { trunkId: id }, select: { routeId: true } })
                ).map((rt) => rt.routeId)
                for (const routeId of affectedRouteIds) {
                    await resyncAllPatterns(tx, routeId)
                }
            }
        })
        await TrunksCache.invalidateTrunk(id)
        await TrunksCache.invalidateByCompany(existing.companyId)
        await TrunksCache.invalidateAllTrunks()
        return getTrunkById(id)
    }

    if (existing.registrationMode === 'outbound' && data.username === null)
        throw new AppError('Tronco outbound exige username', 400)

    const existingIdentifyBy = existing.identifyBy as 'ip' | 'username' | null
    let identifyBy = existingIdentifyBy
    const trunkUpdate: Record<string, any> = { ...data }

    if (existing.registrationMode === 'inbound') {
        if (data.username === null) {
            identifyBy = 'ip'
            trunkUpdate.username = null
            trunkUpdate.password = null
        } else if (data.username) {
            identifyBy = 'username'
            trunkUpdate.password = data.password ?? existing.password ?? generatePassword()
        }
        if (identifyBy !== existingIdentifyBy) trunkUpdate.identifyBy = identifyBy
    }

    const astId = toAsteriskId(existing.company.asteriskId, existing.name)

    const maxInChanged = 'maxInChannels' in data && data.maxInChannels !== existing.maxInChannels
    const maxOutChanged = 'maxOutChannels' in data && data.maxOutChannels !== existing.maxOutChannels
    const customHeadersChanged = 'customHeaders' in data
    // techPrefix vai direto pro Dial() do outbound route (ver outbound-routes.service.ts) — sem resync
    // aqui a trunk fica com prefixo velho gravado no dialplan, silenciosamente
    const techPrefixChanged = 'techPrefix' in data && data.techPrefix !== existing.techPrefix

    await prisma.$transaction(async (tx) => {
        if (existing.type === 'iax') {
            await IaxRepository.updateTrunk(tx, astId, {
                ...data,
                username: trunkUpdate.username,
                password: trunkUpdate.password,
                registrationMode: existing.registrationMode,
                identifyBy,
                existingIdentifyBy,
                existingUsername: existing.username,
            })
        } else {
            await PjsipRepository.updateTrunk(tx, astId, {
                ...data,
                username: trunkUpdate.username,
                password: trunkUpdate.password,
                registrationMode: existing.registrationMode,
                identifyBy,
                existingIdentifyBy,
                existingHost: existing.host,
                existingPort: existing.port,
                existingUsername: existing.username,
            })
        }
        await tx.trunk.update({ where: { id }, data: trunkUpdate })

        if (maxInChanged) {
            const newMax = data.maxInChannels ?? null
            const inboundRoutes = await tx.inboundRoute.findMany({
                where: { trunkId: id },
                select: { destination: true, did: { select: { number: true } } },
            })
            for (const ir of inboundRoutes) {
                await InboundRouteRepository.update(tx, id, ir.did.number, ir.destination as any, newMax)
            }
        }

        if (maxOutChanged || customHeadersChanged || techPrefixChanged) {
            const affectedRouteIds = (
                await tx.outboundRouteTrunk.findMany({ where: { trunkId: id }, select: { routeId: true } })
            ).map((rt) => rt.routeId)
            for (const routeId of affectedRouteIds) {
                await resyncAllPatterns(tx, routeId)
            }
        }
    })

    await TrunksCache.invalidateTrunk(id)
    await TrunksCache.invalidateByCompany(existing.companyId)
    await TrunksCache.invalidateAllTrunks()
    return getTrunkById(id)
}

export const deleteTrunk = async (id: string) => {
    const existing = await prisma.trunk.findUnique({
        where: { id },
        include: { company: { select: { asteriskId: true } } },
    })
    if (!existing) throw new AppError('Trunk not found', 404)

    const astId = toAsteriskId(existing.company.asteriskId, existing.name)
    const endpointId = existing.identifyBy === 'username' && existing.username ? existing.username : astId

    const inboundRoutes = await prisma.inboundRoute.findMany({
        where: { trunkId: id },
        select: { did: { select: { number: true } } },
    })
    const affectedOutboundRouteIds = (
        await prisma.outboundRouteTrunk.findMany({ where: { trunkId: id }, select: { routeId: true } })
    ).map((rt) => rt.routeId)

    await prisma.$transaction(async (tx) => {
        for (const ir of inboundRoutes) {
            await InboundRouteRepository.delete(tx, id, ir.did.number)
        }
        if (existing.registrationMode !== 'custom') {
            if (existing.type === 'iax') await IaxRepository.deleteTrunk(tx, endpointId)
            else await PjsipRepository.deleteTrunk(tx, astId, existing.registrationMode, endpointId)
        }
        await tx.trunk.delete({ where: { id } })
        for (const routeId of affectedOutboundRouteIds) {
            await resyncAllPatterns(tx, routeId)
        }
    })

    for (const routeId of affectedOutboundRouteIds) {
        await OutboundRoutesCache.invalidateRoute(routeId)
    }
    await OutboundRoutesCache.invalidateByCompany(existing.companyId)
    await TrunksCache.invalidateAllTrunks()
}
