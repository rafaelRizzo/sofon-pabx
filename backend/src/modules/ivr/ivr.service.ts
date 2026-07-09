import { Prisma } from '../../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { IvrCache } from './cache/ivr.cache'
import { IvrRepository } from '../../asterisk/ivr.repository'
import { assertAudioBelongsToCompany } from '../audios/audios.service'
import { validateRouteDestination } from '../../schemas/route-destination.validate'
import type { CreateIvrMenuInput, UpdateIvrMenuInput, IvrDest } from './schemas/ivr.schema'
import { AppError } from '../../utils/errors/app.error'

const ivrMenuSelect = {
    id: true,
    name: true,
    companyId: true,
    audioId: true,
    maxDigits: true,
    digitTimeout: true,
    invalidRetries: true,
    invalidDestination: true,
    timeoutRetries: true,
    timeoutDestination: true,
    longDestination: true,
    options: {
        select: { id: true, digit: true, destination: true },
        orderBy: { digit: 'asc' },
    },
    createdAt: true,
    updatedAt: true,
} as const

const toDto = <T extends { audioId: string | null }>(m: T) => ({ ...m, hasAudio: m.audioId !== null })

const validateDest = (dest: IvrDest | undefined | null, companyId: string, label: string) =>
    validateRouteDestination(dest ?? null, companyId, label)

export const getIvrMenusByCompany = async (companyId: string) => {
    const cached = await IvrCache.getByCompany(companyId)
    if (cached) return cached

    await getCompanyById(companyId)

    const menus = await prisma.ivrMenu.findMany({ where: { companyId }, select: ivrMenuSelect })
    const dtos = menus.map(toDto)
    await IvrCache.setByCompany(companyId, dtos)
    return dtos
}

export const getIvrMenuById = async (id: string) => {
    const cached = await IvrCache.getMenu(id)
    if (cached) return cached

    const menu = await prisma.ivrMenu.findUnique({ where: { id }, select: ivrMenuSelect })
    if (!menu) throw new AppError('IVR menu not found', 404)

    const dto = toDto(menu)
    await IvrCache.setMenu(id, dto)
    return dto
}

export const createIvrMenu = async (data: CreateIvrMenuInput) => {
    await getCompanyById(data.companyId)

    const existing = await prisma.ivrMenu.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('IVR menu already exists for this company', 409)

    const options = data.options ?? []

    await assertAudioBelongsToCompany(data.audioId, data.companyId)
    await validateDest(data.invalidDestination, data.companyId, 'invalidDestination')
    await validateDest(data.timeoutDestination, data.companyId, 'timeoutDestination')
    await validateDest(data.longDestination, data.companyId, 'longDestination')
    for (const opt of options) {
        await validateDest(opt.destination, data.companyId, `option ${opt.digit}`)
    }

    const menu = await prisma.$transaction(async (tx) => {
        const created = await tx.ivrMenu.create({
            data: {
                name: data.name,
                companyId: data.companyId,
                audioId: data.audioId,
                maxDigits: data.maxDigits,
                digitTimeout: data.digitTimeout,
                invalidRetries: data.invalidRetries,
                invalidDestination: data.invalidDestination ?? undefined,
                timeoutRetries: data.timeoutRetries,
                timeoutDestination: data.timeoutDestination ?? undefined,
                longDestination: data.longDestination ?? undefined,
            },
        })
        if (options.length > 0) {
            await tx.ivrOption.createMany({
                data: options.map((o) => ({ ivrMenuId: created.id, digit: o.digit, destination: o.destination ?? undefined })),
            })
        }
        return tx.ivrMenu.findUniqueOrThrow({ where: { id: created.id }, select: ivrMenuSelect })
    })

    try {
        await IvrRepository.regenerate(data.companyId)
    } finally {
        await IvrCache.invalidateByCompany(data.companyId)
    }
    return toDto(menu)
}

export const updateIvrMenu = async (id: string, data: UpdateIvrMenuInput) => {
    const existing = await prisma.ivrMenu.findUnique({ where: { id } })
    if (!existing) throw new AppError('IVR menu not found', 404)

    if (data.name && data.name !== existing.name) {
        const dup = await prisma.ivrMenu.findUnique({
            where: { name_companyId: { name: data.name, companyId: existing.companyId } },
        })
        if (dup) throw new AppError('IVR menu name already in use for this company', 409)
    }

    if (data.audioId !== undefined) await assertAudioBelongsToCompany(data.audioId, existing.companyId)
    if (data.invalidDestination !== undefined) await validateDest(data.invalidDestination, existing.companyId, 'invalidDestination')
    if (data.timeoutDestination !== undefined) await validateDest(data.timeoutDestination, existing.companyId, 'timeoutDestination')
    if (data.longDestination !== undefined) await validateDest(data.longDestination, existing.companyId, 'longDestination')
    if (data.options !== undefined) {
        for (const opt of data.options) {
            await validateDest(opt.destination, existing.companyId, `option ${opt.digit}`)
        }
    }

    const menu = await prisma.$transaction(async (tx) => {
        const updated = await tx.ivrMenu.update({
            where: { id },
            data: {
                name: data.name,
                audioId: data.audioId,
                maxDigits: data.maxDigits,
                digitTimeout: data.digitTimeout,
                invalidRetries: data.invalidRetries,
                invalidDestination: data.invalidDestination === undefined ? undefined : (data.invalidDestination ?? Prisma.JsonNull),
                timeoutRetries: data.timeoutRetries,
                timeoutDestination: data.timeoutDestination === undefined ? undefined : (data.timeoutDestination ?? Prisma.JsonNull),
                longDestination: data.longDestination === undefined ? undefined : (data.longDestination ?? Prisma.JsonNull),
            },
            select: ivrMenuSelect,
        })
        if (data.options !== undefined) {
            await tx.ivrOption.deleteMany({ where: { ivrMenuId: id } })
            if (data.options.length > 0) {
                await tx.ivrOption.createMany({
                    data: data.options.map((o) => ({ ivrMenuId: id, digit: o.digit, destination: o.destination ?? undefined })),
                })
            }
        }
        if (data.options === undefined) return updated
        return await tx.ivrMenu.findUniqueOrThrow({ where: { id }, select: ivrMenuSelect })
    })

    try {
        await IvrRepository.regenerate(existing.companyId)
    } finally {
        await IvrCache.invalidateMenu(id)
        await IvrCache.invalidateByCompany(existing.companyId)
    }
    return toDto(menu)
}

export const deleteIvrMenu = async (id: string) => {
    const existing = await prisma.ivrMenu.findUnique({ where: { id }, select: { companyId: true } })
    if (!existing) throw new AppError('IVR menu not found', 404)

    await prisma.$transaction(async (tx) => {
        await tx.ivrMenu.delete({ where: { id } })
    })

    try {
        await IvrRepository.regenerate(existing.companyId)
    } finally {
        await IvrCache.invalidateMenu(id)
        await IvrCache.invalidateByCompany(existing.companyId)
    }
}
