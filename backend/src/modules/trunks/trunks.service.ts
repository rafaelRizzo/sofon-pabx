import { randomBytes } from 'crypto'
import { prisma } from '../../lib/prisma'
import { TrunksCache } from './cache/trunks.cache'
import type { CreateTrunkInput, UpdateTrunkInput } from './schemas/trunk.schema'
import { PjsipRepository } from '../../asterisk/pjsip.repository'
import { AppError } from '../../utils/errors/app.error'

const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const generatePassword = () => {
    const bytes = randomBytes(20)
    return Array.from(bytes, (b) => CHARSET[b % CHARSET.length]).join('')
}

const toAsteriskId = (asteriskId: string, name: string) => `${asteriskId}-trunk-${name}`

const trunkSelect = {
    id: true,
    name: true,
    companyId: true,
    registrationMode: true,
    host: true,
    username: true,
    context: true,
    codecs: true,
    metadata: true,
    createdAt: true,
    updatedAt: true,
} as const

export const getTrunks = async (companyId: string) => {
    const cached = await TrunksCache.getByCompany(companyId)
    if (cached) return cached

    const company = await prisma.company.findUnique({ where: { id: companyId } })
    if (!company) throw new AppError('Company not found', 404)

    const trunks = await prisma.trunk.findMany({ where: { companyId }, select: trunkSelect })
    await TrunksCache.setByCompany(companyId, trunks)
    return trunks
}

export const getTrunkById = async (id: string) => {
    const cached = await TrunksCache.getTrunk(id)
    if (cached) return cached

    const trunk = await prisma.trunk.findUnique({ where: { id }, select: trunkSelect })
    if (!trunk) throw new AppError('Trunk not found', 404)

    await TrunksCache.setTrunk(id, trunk)
    return trunk
}

export const createTrunk = async (data: CreateTrunkInput) => {
    const company = await prisma.company.findUnique({ where: { id: data.companyId }, select: { asteriskId: true } })
    if (!company) throw new AppError('Company not found', 404)

    const existing = await prisma.trunk.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Trunk already exists for this company', 409)

    const astId = toAsteriskId(company.asteriskId, data.name)
    const password = data.password ?? generatePassword()
    const username = data.username ?? astId

    await prisma.$transaction(async (tx) => {
        await PjsipRepository.createTrunk(tx, astId, {
            username,
            password,
            context: data.context,
            codecs: data.codecs,
            registrationMode: data.registrationMode,
            host: data.registrationMode === 'outbound' ? data.host : undefined,
        })

        await tx.trunk.create({
            data: {
                name: data.name,
                companyId: data.companyId,
                registrationMode: data.registrationMode,
                host: data.registrationMode === 'outbound' ? data.host : (data.host ?? null),
                username,
                password,
                context: data.context,
                codecs: data.codecs,
            },
        })
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

    const astId = toAsteriskId(existing.company.asteriskId, existing.name)

    await prisma.$transaction(async (tx) => {
        await PjsipRepository.updateTrunk(tx, astId, {
            ...data,
            registrationMode: existing.registrationMode,
            existingHost: existing.host,
            existingUsername: existing.username,
        })
        await tx.trunk.update({ where: { id }, data })
    })

    await TrunksCache.invalidateTrunk(id)
    await TrunksCache.invalidateByCompany(existing.companyId)
    return getTrunkById(id)
}

export const deleteTrunk = async (id: string) => {
    const existing = await prisma.trunk.findUnique({
        where: { id },
        include: { company: { select: { asteriskId: true } } },
    })
    if (!existing) throw new AppError('Trunk not found', 404)

    const astId = toAsteriskId(existing.company.asteriskId, existing.name)

    await prisma.$transaction(async (tx) => {
        await PjsipRepository.deleteTrunk(tx, astId, existing.registrationMode)
        await tx.trunk.delete({ where: { id } })
    })

    await TrunksCache.invalidateAllTrunks()
}
