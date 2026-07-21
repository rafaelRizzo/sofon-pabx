import { createId } from '@paralleldrive/cuid2'
import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { IvrCache } from './cache/ivr.cache'
import { IvrRepository } from '../../asterisk/ivr.repository'
import { FlowEdgeRepository } from '../../asterisk/flow-edge.repository'
import { assertAudioBelongsToCompany } from '../audios/audios.service'
import { validateRouteDestination, assertNotReferenced } from '../../schemas/route-destination.validate'
import { resolveDestinationLabels, withDestinationLabel } from '../../schemas/route-destination-label'
import { resolveUsedByLabels, type UsedByRef } from '../../schemas/flow-reference-label'
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
    timeoutRetries: true,
    options: {
        select: { id: true, digit: true },
        orderBy: { digit: 'asc' },
    },
    createdAt: true,
    updatedAt: true,
} as const

const toDto = <T extends { audioId: string | null; usedBy: UsedByRef[] }>(m: T) => ({ ...m, hasAudio: m.audioId !== null })

const _byId = () => prisma.ivrMenu.findUnique({ where: { id: '' }, select: ivrMenuSelect })
type IvrMenuRow = Omit<NonNullable<Awaited<ReturnType<typeof _byId>>>, 'options'> & {
    invalidDestination: IvrDest
    timeoutDestination: IvrDest
    longDestination: IvrDest
    options: { id: string; digit: string; destination: IvrDest }[]
}

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
    let rows = (await IvrCache.getByCompany(companyId)) as IvrMenuRow[] | null
    if (!rows) {
        await getCompanyById(companyId)

        const [menuRows, menuEdges, optionEdges] = await Promise.all([
            prisma.ivrMenu.findMany({ where: { companyId }, select: ivrMenuSelect }),
            FlowEdgeRepository.getBySource(companyId, 'ivrmenu'),
            FlowEdgeRepository.getBySource(companyId, 'ivroption'),
        ])
        rows = menuRows.map((m) => ({
            ...m,
            invalidDestination: menuEdges.get(m.id)?.invalid ?? null,
            timeoutDestination: menuEdges.get(m.id)?.timeout ?? null,
            longDestination: menuEdges.get(m.id)?.long ?? null,
            options: m.options.map((o) => ({ ...o, destination: optionEdges.get(o.id)?.default ?? null })),
        }))
        await IvrCache.setByCompany(companyId, rows)
    }

    const usedByMap = await resolveUsedByLabels('ivr', rows.map((m) => m.id), companyId)
    return withDestinationLabels(
        rows.map((m) => toDto({ ...m, usedBy: usedByMap.get(m.id) ?? [] })),
        companyId,
    )
}

export const getIvrMenuById = async (id: string) => {
    let row = (await IvrCache.getMenu(id)) as IvrMenuRow | null
    if (!row) {
        const menu = await prisma.ivrMenu.findUnique({ where: { id }, select: ivrMenuSelect })
        if (!menu) throw new AppError('IVR menu not found', 404)

        const [invalidDestination, timeoutDestination, longDestination, optionDests] = await Promise.all([
            FlowEdgeRepository.getOne('ivrmenu', id, 'invalid'),
            FlowEdgeRepository.getOne('ivrmenu', id, 'timeout'),
            FlowEdgeRepository.getOne('ivrmenu', id, 'long'),
            Promise.all(menu.options.map((o) => FlowEdgeRepository.getOne('ivroption', o.id, 'default'))),
        ])
        row = {
            ...menu,
            invalidDestination, timeoutDestination, longDestination,
            options: menu.options.map((o, i) => ({ ...o, destination: optionDests[i] ?? null })),
        }
        await IvrCache.setMenu(id, row)
    }

    const usedByMap = await resolveUsedByLabels('ivr', [id], row.companyId)
    return (await withDestinationLabels([toDto({ ...row, usedBy: usedByMap.get(id) ?? [] })], row.companyId))[0]!
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

    const optionIds = options.map(() => createId())

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
                timeoutRetries: data.timeoutRetries,
            },
        })
        await Promise.all([
            FlowEdgeRepository.setSlot(tx, data.companyId, 'ivrmenu', created.id, 'invalid', data.invalidDestination ?? null),
            FlowEdgeRepository.setSlot(tx, data.companyId, 'ivrmenu', created.id, 'timeout', data.timeoutDestination ?? null),
            FlowEdgeRepository.setSlot(tx, data.companyId, 'ivrmenu', created.id, 'long', data.longDestination ?? null),
        ])
        if (options.length > 0) {
            await tx.ivrOption.createMany({
                data: options.map((o, i) => ({ id: optionIds[i], ivrMenuId: created.id, digit: o.digit })),
            })
            await Promise.all(options.map((o, i) =>
                FlowEdgeRepository.setSlot(tx, data.companyId, 'ivroption', optionIds[i]!, 'default', o.destination ?? null),
            ))
        }
        return tx.ivrMenu.findUniqueOrThrow({ where: { id: created.id }, select: ivrMenuSelect })
    })

    try {
        await IvrRepository.regenerate(data.companyId)
    } finally {
        await IvrCache.invalidateByCompany(data.companyId)
    }
    const optionDestById = new Map(optionIds.map((oid, i) => [oid, options[i]?.destination ?? null]))
    return toDto({
        ...menu,
        invalidDestination: data.invalidDestination ?? null,
        timeoutDestination: data.timeoutDestination ?? null,
        longDestination: data.longDestination ?? null,
        options: menu.options.map((o) => ({ ...o, destination: optionDestById.get(o.id) ?? null })),
        usedBy: [],
    })
}

export const updateIvrMenu = async (id: string, data: UpdateIvrMenuInput) => {
    const existing = await prisma.ivrMenu.findUnique({
        where: { id },
        include: { _count: { select: { options: true } }, options: { select: { id: true } } },
    })
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

    const newOptionIds = data.options?.map(() => createId())

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
                timeoutRetries: data.timeoutRetries,
            },
            select: ivrMenuSelect,
        })
        await Promise.all([
            data.invalidDestination !== undefined ? FlowEdgeRepository.setSlot(tx, existing.companyId, 'ivrmenu', id, 'invalid', data.invalidDestination) : null,
            data.timeoutDestination !== undefined ? FlowEdgeRepository.setSlot(tx, existing.companyId, 'ivrmenu', id, 'timeout', data.timeoutDestination) : null,
            data.longDestination !== undefined ? FlowEdgeRepository.setSlot(tx, existing.companyId, 'ivrmenu', id, 'long', data.longDestination) : null,
        ])
        if (data.options !== undefined) {
            if (existing.options.length > 0) {
                await FlowEdgeRepository.deleteAllForSources(tx, 'ivroption', existing.options.map((o) => o.id))
            }
            await tx.ivrOption.deleteMany({ where: { ivrMenuId: id } })
            if (data.options.length > 0) {
                await tx.ivrOption.createMany({
                    data: data.options.map((o, i) => ({ id: newOptionIds![i], ivrMenuId: id, digit: o.digit })),
                })
                await Promise.all(data.options.map((o, i) =>
                    FlowEdgeRepository.setSlot(tx, existing.companyId, 'ivroption', newOptionIds![i]!, 'default', o.destination ?? null),
                ))
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

    const [invalidDestination, timeoutDestination, longDestination, usedByMap] = await Promise.all([
        data.invalidDestination !== undefined ? data.invalidDestination : FlowEdgeRepository.getOne('ivrmenu', id, 'invalid'),
        data.timeoutDestination !== undefined ? data.timeoutDestination : FlowEdgeRepository.getOne('ivrmenu', id, 'timeout'),
        data.longDestination !== undefined ? data.longDestination : FlowEdgeRepository.getOne('ivrmenu', id, 'long'),
        resolveUsedByLabels('ivr', [id], existing.companyId),
    ])
    const options = data.options !== undefined
        ? (() => {
            const optionDestById = new Map(newOptionIds!.map((oid, i) => [oid, data.options![i]?.destination ?? null]))
            return menu.options.map((o) => ({ ...o, destination: optionDestById.get(o.id) ?? null }))
        })()
        : await Promise.all(menu.options.map(async (o) => ({ ...o, destination: await FlowEdgeRepository.getOne('ivroption', o.id, 'default') })))

    return toDto({ ...menu, invalidDestination, timeoutDestination, longDestination, options, usedBy: usedByMap.get(id) ?? [] })
}

export const deleteIvrMenu = async (id: string) => {
    const existing = await prisma.ivrMenu.findUnique({
        where: { id },
        select: { companyId: true, options: { select: { id: true } } },
    })
    if (!existing) throw new AppError('IVR menu not found', 404)

    await assertNotReferenced('ivr', id)

    await prisma.$transaction(async (tx) => {
        await tx.ivrMenu.delete({ where: { id } })
        await FlowEdgeRepository.deleteAllForSource(tx, 'ivrmenu', id)
        if (existing.options.length > 0) {
            await FlowEdgeRepository.deleteAllForSources(tx, 'ivroption', existing.options.map((o) => o.id))
        }
    })

    try {
        await IvrRepository.regenerate(existing.companyId)
    } finally {
        await IvrCache.invalidateMenu(id)
        await IvrCache.invalidateByCompany(existing.companyId)
    }
}
