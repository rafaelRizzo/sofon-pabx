import { Prisma } from '../../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { IvrCache } from './cache/ivr.cache'
import { IvrRepository } from '../../asterisk/ivr.repository'
import { assertAudioBelongsToCompany } from '../audios/audios.service'
import { validateRouteDestination } from '../../schemas/route-destination.validate'
import { resolveDestinationLabels, withDestinationLabel } from '../../schemas/route-destination-label'
import type { CreateIvrMenuInput, UpdateIvrMenuInput, IvrDest } from './schemas/ivr.schema'
import { AppError } from '../../utils/errors/app.error'

const ivrMenuSelect = {
    id: true,
    name: true,
    companyId: true,
    type: true,
    variableName: true,
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

// Regras de consistência entre type/variableName/options/maxDigits (ver ivr.schema.ts:
// mesmas 4 regras já aplicadas via superRefine no create; aqui repetidas porque o update é
// parcial e só dá pra checar depois de mesclar com o registro existente, ver updateIvrMenu)
const assertTypeConsistency = (
    type: 'menu' | 'collect',
    variableName: string | null | undefined,
    optionsCount: number,
    maxDigits: number,
) => {
    if (type === 'collect') {
        if (!variableName) throw new AppError('variableName is required when type is collect', 400)
        if (optionsCount > 0) throw new AppError('collect type cannot have digit options', 400)
        if (maxDigits < 2) throw new AppError('collect type requires maxDigits >= 2', 400)
    } else if (variableName) {
        throw new AppError('variableName only applies to collect type', 400)
    }
}

// Anexa o nome legível de invalidDestination/timeoutDestination/longDestination/options[].destination
// (resolvido no backend, cache-first — ver route-destination-label.ts). Todas as chamadas aqui são
// de uma única empresa por vez — sem visão cross-empresa nesse módulo (sem getAllIvrMenus).
type IvrDestFields = {
    invalidDestination: unknown
    timeoutDestination: unknown
    longDestination: unknown
    options: { destination: unknown }[]
}
async function withDestinationLabels<T extends IvrDestFields>(menus: T[], companyId: string): Promise<T[]> {
    if (menus.length === 0) return menus
    const labelMap = await resolveDestinationLabels(
        menus.flatMap((m) => [
            m.invalidDestination as IvrDest,
            m.timeoutDestination as IvrDest,
            m.longDestination as IvrDest,
            ...m.options.map((o) => o.destination as IvrDest),
        ]),
        companyId,
    )
    return menus.map((m) => ({
        ...m,
        invalidDestination: withDestinationLabel(m.invalidDestination as IvrDest, labelMap),
        timeoutDestination: withDestinationLabel(m.timeoutDestination as IvrDest, labelMap),
        longDestination: withDestinationLabel(m.longDestination as IvrDest, labelMap),
        options: m.options.map((o) => ({ ...o, destination: withDestinationLabel(o.destination as IvrDest, labelMap) })),
    }))
}

export const getIvrMenusByCompany = async (companyId: string) => {
    const cached = await IvrCache.getByCompany(companyId)
    if (cached) return cached

    await getCompanyById(companyId)

    const menus = await withDestinationLabels((await prisma.ivrMenu.findMany({ where: { companyId }, select: ivrMenuSelect })).map(toDto), companyId)
    await IvrCache.setByCompany(companyId, menus)
    return menus
}

export const getIvrMenuById = async (id: string) => {
    const cached = await IvrCache.getMenu(id)
    if (cached) return cached

    const menu = await prisma.ivrMenu.findUnique({ where: { id }, select: ivrMenuSelect })
    if (!menu) throw new AppError('IVR menu not found', 404)

    const dto = (await withDestinationLabels([toDto(menu)], menu.companyId))[0]!
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
    assertTypeConsistency(data.type, data.variableName, options.length, data.maxDigits)

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
                type: data.type,
                variableName: data.variableName ?? null,
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
    const existing = await prisma.ivrMenu.findUnique({ where: { id }, include: { _count: { select: { options: true } } } })
    if (!existing) throw new AppError('IVR menu not found', 404)

    if (data.name && data.name !== existing.name) {
        const dup = await prisma.ivrMenu.findUnique({
            where: { name_companyId: { name: data.name, companyId: existing.companyId } },
        })
        if (dup) throw new AppError('IVR menu name already in use for this company', 409)
    }

    assertTypeConsistency(
        (data.type ?? existing.type) as 'menu' | 'collect',
        data.variableName !== undefined ? data.variableName : existing.variableName,
        data.options !== undefined ? data.options.length : existing._count.options,
        data.maxDigits ?? existing.maxDigits,
    )

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
                type: data.type,
                variableName: data.variableName,
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
