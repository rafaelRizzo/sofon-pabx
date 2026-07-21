import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { HolidayGroupsCache } from './cache/holiday-groups.cache'
import type { CreateHolidayGroupInput, UpdateHolidayGroupInput, RouteDest } from './schemas/holiday-group.schema'
import { HolidayGroupRepository } from '../../asterisk/holidaygroup.repository'
import { FlowEdgeRepository } from '../../asterisk/flow-edge.repository'
import { validateRouteDestination, assertNotReferenced } from '../../schemas/route-destination.validate'
import { resolveDestinationLabels, withDestinationLabel } from '../../schemas/route-destination-label'
import { resolveUsedByLabels, type UsedByRef } from '../../schemas/flow-reference-label'
import { fetchHolidaysFromUrl } from './providers/http.provider'
import { AppError } from '../../utils/errors/app.error'
import { logger } from '../../utils/logger'

const holidayGroupSelect = {
    id: true,
    name: true,
    companyId: true,
    url: true,
    dates: { select: { id: true, name: true, month: true, day: true } },
    createdAt: true,
    updatedAt: true,
} as const

const _byId = () => prisma.holidayGroup.findUnique({ where: { id: '' }, select: holidayGroupSelect })
export type HolidayGroupDto = NonNullable<Awaited<ReturnType<typeof _byId>>> & { trueRoute: RouteDest; falseRoute: RouteDest; usedBy: UsedByRef[] }

type DateInput = { name: string; month: number; day: number }

const validateRoute = (route: RouteDest | undefined | null, companyId: string, label: string) =>
    validateRouteDestination(route ?? null, companyId, label)

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function datesFromUrl(url: string, year: number): Promise<DateInput[]> {
    const remote = await fetchHolidaysFromUrl(url, year)
    if (!remote) {
        logger.warn({ event: 'holidays.provider.fallback', url, year })
        return []
    }
    return remote
}

// Chamado só pelo job de resync (src/jobs/holiday-resync.job.ts) — busca a URL configurada e
// SUBSTITUI as datas do grupo. Não-op se o grupo não tiver url (grupo manual, fora do escopo do job).
export async function resyncHolidayGroupFromUrl(tx: Tx, id: string, year: number) {
    const hg = await tx.holidayGroup.findUnique({
        where: { id },
        select: { name: true, url: true },
    })
    if (!hg || !hg.url) return

    const dates = await datesFromUrl(hg.url, year)

    await tx.holidayDate.deleteMany({ where: { holidayGroupId: id } })
    if (dates.length > 0) await tx.holidayDate.createMany({ data: dates.map((d) => ({ ...d, holidayGroupId: id })) })
}

export async function resyncAllHolidayGroupsFromUrl(year: number) {
    const groups = await prisma.holidayGroup.findMany({ where: { url: { not: null } }, select: { id: true, companyId: true } })
    for (const { id } of groups) {
        await prisma.$transaction((tx) => resyncHolidayGroupFromUrl(tx, id, year))
    }

    const companyIds = [...new Set(groups.map((g) => g.companyId))]
    try {
        for (const companyId of companyIds) await HolidayGroupRepository.regenerate(companyId)
    } finally {
        if (groups.length > 0) await HolidayGroupsCache.invalidateNamespace()
    }
    return groups.length
}

// Anexa o nome legível de trueRoute/falseRoute (resolvido no backend, cache-first — ver
// route-destination-label.ts). Todas as chamadas aqui são de uma única empresa por vez —
// sem visão cross-empresa nesse módulo (sem getAllHolidayGroups).
async function withDestinationLabels<T extends { trueRoute: unknown; falseRoute: unknown }>(
    groups: T[],
    companyId: string,
): Promise<T[]> {
    if (groups.length === 0) return groups
    const labelMap = await resolveDestinationLabels(
        groups.flatMap((g) => [g.trueRoute as RouteDest, g.falseRoute as RouteDest]),
        companyId,
    )
    return groups.map((g) => ({
        ...g,
        trueRoute: withDestinationLabel(g.trueRoute as RouteDest, labelMap),
        falseRoute: withDestinationLabel(g.falseRoute as RouteDest, labelMap),
    }))
}

export const getHolidayGroupsByCompany = async (companyId: string) => {
    const cached = await HolidayGroupsCache.getByCompany(companyId)
    if (cached) return cached

    await getCompanyById(companyId)

const [rows, edges] = await Promise.all([
        prisma.holidayGroup.findMany({ where: { companyId }, select: holidayGroupSelect }),
        FlowEdgeRepository.getBySource(companyId, 'holidaygroup'),
    ])
    const usedByMap = await resolveUsedByLabels('holiday', rows.map((h) => h.id), companyId)
    const groups = await withDestinationLabels(rows.map((hg) => ({
        ...hg,
        trueRoute: edges.get(hg.id)?.true ?? null,
        falseRoute: edges.get(hg.id)?.false ?? null,
        usedBy: usedByMap.get(hg.id) ?? [],
    })), companyId)
    await HolidayGroupsCache.setByCompany(companyId, groups)
    return groups
}

export const getHolidayGroupById = async (id: string): Promise<HolidayGroupDto> => {
    const cached = await HolidayGroupsCache.getHolidayGroup(id)
    if (cached) return cached as HolidayGroupDto

    const found = await prisma.holidayGroup.findUnique({ where: { id }, select: holidayGroupSelect })
    if (!found) throw new AppError('Holiday group not found', 404)

    const [trueRoute, falseRoute, usedByMap] = await Promise.all([
        FlowEdgeRepository.getOne('holidaygroup', id, 'true'),
        FlowEdgeRepository.getOne('holidaygroup', id, 'false'),
        resolveUsedByLabels('holiday', [id], found.companyId),
    ])
    const hg = (await withDestinationLabels([{ ...found, trueRoute, falseRoute, usedBy: usedByMap.get(id) ?? [] }], found.companyId))[0]!
    await HolidayGroupsCache.setHolidayGroup(id, hg)
    return hg
}

export const createHolidayGroup = async (data: CreateHolidayGroupInput) => {
    await getCompanyById(data.companyId)

    const existing = await prisma.holidayGroup.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Holiday group already exists for this company', 409)

    await validateRoute(data.trueRoute, data.companyId, 'trueRoute')
    await validateRoute(data.falseRoute, data.companyId, 'falseRoute')

    const initialDates: DateInput[] = data.url ? await datesFromUrl(data.url, new Date().getFullYear()) : (data.dates ?? [])

    const hg = await prisma.$transaction(async (tx) => {
        const created = await tx.holidayGroup.create({
            data: {
                name: data.name,
                companyId: data.companyId,
                url: data.url ?? null,
                dates: initialDates.length > 0 ? { create: initialDates } : undefined,
            },
            select: holidayGroupSelect,
        })
        await Promise.all([
            FlowEdgeRepository.setSlot(tx, data.companyId, 'holidaygroup', created.id, 'true', data.trueRoute ?? null),
            FlowEdgeRepository.setSlot(tx, data.companyId, 'holidaygroup', created.id, 'false', data.falseRoute ?? null),
        ])
        return created
    })

    try {
        await HolidayGroupRepository.regenerate(data.companyId)
    } finally {
        await HolidayGroupsCache.invalidateByCompany(data.companyId)
    }
    return { ...hg, trueRoute: data.trueRoute ?? null, falseRoute: data.falseRoute ?? null, usedBy: [] }
}

export const updateHolidayGroup = async (id: string, data: UpdateHolidayGroupInput) => {
    const existing = await prisma.holidayGroup.findUnique({ where: { id }, include: { dates: true } })
    if (!existing) throw new AppError('Holiday group not found', 404)

    if (data.name && data.name !== existing.name) {
        const dup = await prisma.holidayGroup.findUnique({
            where: { name_companyId: { name: data.name, companyId: existing.companyId } },
        })
        if (dup) throw new AppError('Holiday group name already in use for this company', 409)
    }

    if (data.trueRoute !== undefined) await validateRoute(data.trueRoute, existing.companyId, 'trueRoute')
    if (data.falseRoute !== undefined) await validateRoute(data.falseRoute, existing.companyId, 'falseRoute')

    const newUrl = data.url !== undefined ? data.url : existing.url

    if (data.dates !== undefined && newUrl) throw new AppError('Cannot set dates manually when url is configured', 400)

    const urlJustSet = !!newUrl && newUrl !== existing.url
    const newDates: DateInput[] | undefined = data.dates !== undefined
        ? data.dates
        : urlJustSet
            ? await datesFromUrl(newUrl!, new Date().getFullYear())
            : undefined

    const effectiveDates: DateInput[] = newDates ?? existing.dates.map((d) => ({ name: d.name, month: d.month, day: d.day }))

    const hg = await prisma.$transaction(async (tx) => {
        if (newDates !== undefined) {
            await tx.holidayDate.deleteMany({ where: { holidayGroupId: id } })
            if (newDates.length > 0) await tx.holidayDate.createMany({ data: newDates.map((d) => ({ ...d, holidayGroupId: id })) })
        }

        const updated = await tx.holidayGroup.update({
            where: { id },
            data: {
                name: data.name,
                url: data.url === undefined ? undefined : data.url,
            },
            select: holidayGroupSelect,
        })
        await Promise.all([
            data.trueRoute !== undefined ? FlowEdgeRepository.setSlot(tx, existing.companyId, 'holidaygroup', id, 'true', data.trueRoute) : null,
            data.falseRoute !== undefined ? FlowEdgeRepository.setSlot(tx, existing.companyId, 'holidaygroup', id, 'false', data.falseRoute) : null,
        ])

        return updated
    })

    try {
        await HolidayGroupRepository.regenerate(existing.companyId)
    } finally {
        await HolidayGroupsCache.invalidateHolidayGroup(id)
        await HolidayGroupsCache.invalidateByCompany(existing.companyId)
    }
    const [trueRoute, falseRoute, usedByMap] = await Promise.all([
        data.trueRoute !== undefined ? data.trueRoute : FlowEdgeRepository.getOne('holidaygroup', id, 'true'),
        data.falseRoute !== undefined ? data.falseRoute : FlowEdgeRepository.getOne('holidaygroup', id, 'false'),
        resolveUsedByLabels('holiday', [id], existing.companyId),
    ])
    return { ...hg, trueRoute, falseRoute, usedBy: usedByMap.get(id) ?? [] }
}

export const deleteHolidayGroup = async (id: string) => {
    const existing = await prisma.holidayGroup.findUnique({ where: { id } })
    if (!existing) throw new AppError('Holiday group not found', 404)

    await assertNotReferenced('holiday', id)

    await prisma.$transaction(async (tx) => {
        await tx.holidayGroup.delete({ where: { id } })
        await FlowEdgeRepository.deleteAllForSource(tx, 'holidaygroup', id)
    })

    try {
        await HolidayGroupRepository.regenerate(existing.companyId)
    } finally {
        await HolidayGroupsCache.invalidateHolidayGroup(id)
        await HolidayGroupsCache.invalidateByCompany(existing.companyId)
    }
}
