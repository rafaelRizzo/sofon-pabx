import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { TimeConditionsCache } from './cache/time-conditions.cache'
import type { CreateTimeConditionInput, UpdateTimeConditionInput, RouteDest } from './schemas/time-condition.schema'
import { TimeConditionRepository } from '../../asterisk/timecondition.repository'
import { FlowEdgeRepository } from '../../asterisk/flow-edge.repository'
import { validateRouteDestination, assertNotReferenced } from '../../schemas/route-destination.validate'
import { resolveDestinationLabels, withDestinationLabel } from '../../schemas/route-destination-label'
import { resolveUsedByLabels, type UsedByRef } from '../../schemas/flow-reference-label'
import { AppError } from '../../utils/errors/app.error'

const timeConditionSelect = {
    id: true,
    name: true,
    companyId: true,
    timeGroups: {
        select: {
            timeGroup: { select: { id: true, name: true } },
        },
    },
    createdAt: true,
    updatedAt: true,
} as const

const _byId = () => prisma.timeCondition.findUnique({ where: { id: '' }, select: timeConditionSelect })
export type TimeConditionDto = NonNullable<Awaited<ReturnType<typeof _byId>>> & { trueRoute: RouteDest; falseRoute: RouteDest; usedBy: UsedByRef[] }

const validateRoute = (route: RouteDest | undefined | null, companyId: string, label: string) =>
    validateRouteDestination(route ?? null, companyId, label)

// Anexa o nome legível de trueRoute/falseRoute (resolvido no backend, cache-first — ver
// route-destination-label.ts). Agrupa por companyId — getAllTimeConditions pode misturar
// empresas diferentes na mesma lista (visão admin).
async function withDestinationLabels<T extends { trueRoute: unknown; falseRoute: unknown; companyId: string }>(
    conditions: T[],
): Promise<T[]> {
    if (conditions.length === 0) return conditions
    const byCompany = new Map<string, RouteDest[]>()
    for (const c of conditions) {
        const arr = byCompany.get(c.companyId) ?? []
        arr.push(c.trueRoute as RouteDest, c.falseRoute as RouteDest)
        byCompany.set(c.companyId, arr)
    }
    const labelMaps = new Map(
        await Promise.all([...byCompany.entries()].map(async ([companyId, dests]) => [companyId, await resolveDestinationLabels(dests, companyId)] as const)),
    )
    return conditions.map((c) => {
        const labelMap = labelMaps.get(c.companyId)!
        return {
            ...c,
            trueRoute: withDestinationLabel(c.trueRoute as RouteDest, labelMap),
            falseRoute: withDestinationLabel(c.falseRoute as RouteDest, labelMap),
        }
    })
}

// Resolve usedBy agrupado por companyId — mesmo motivo de withDestinationLabels acima:
// getAllTimeConditions pode misturar empresas diferentes na mesma lista (visão admin), e
// resolveUsedByLabels precisa de um companyId por chamada.
async function resolveUsedByMap<T extends { id: string; companyId: string }>(rows: T[]): Promise<Map<string, UsedByRef[]>> {
    if (rows.length === 0) return new Map()
    const idsByCompany = new Map<string, string[]>()
    for (const r of rows) {
        const arr = idsByCompany.get(r.companyId) ?? []
        arr.push(r.id)
        idsByCompany.set(r.companyId, arr)
    }
    const maps = await Promise.all(
        [...idsByCompany.entries()].map(([companyId, ids]) => resolveUsedByLabels('timecondition', ids, companyId)),
    )
    const merged = new Map<string, UsedByRef[]>()
    for (const m of maps) for (const [id, refs] of m) merged.set(id, refs)
    return merged
}

export const getTimeConditionsByCompany = async (companyId: string) => {
    const cached = await TimeConditionsCache.getByCompany(companyId)
    if (cached) return cached

    await getCompanyById(companyId)

    const [rows, edges] = await Promise.all([
        prisma.timeCondition.findMany({ where: { companyId }, select: timeConditionSelect }),
        FlowEdgeRepository.getBySource(companyId, 'timecondition'),
    ])
    const usedByMap = await resolveUsedByLabels('timecondition', rows.map((tc) => tc.id), companyId)
    const conditions = await withDestinationLabels(rows.map((tc) => ({
        ...tc,
        trueRoute: edges.get(tc.id)?.true ?? null,
        falseRoute: edges.get(tc.id)?.false ?? null,
        usedBy: usedByMap.get(tc.id) ?? [],
    })))
    await TimeConditionsCache.setByCompany(companyId, conditions)
    return conditions
}

export const getAllTimeConditions = async (companyIds?: string[]) => {
    if (companyIds && companyIds.length === 0) return []

    if (!companyIds) {
        const cached = await TimeConditionsCache.getAll()
        if (cached) return cached
    }

    const rows = await prisma.timeCondition.findMany({
        where: companyIds ? { companyId: { in: companyIds } } : undefined,
        select: timeConditionSelect,
    })
    const [edges, usedByMap] = await Promise.all([
        FlowEdgeRepository.getBySourceIds('timecondition', rows.map((tc) => tc.id)),
        resolveUsedByMap(rows),
    ])
    const conditions = await withDestinationLabels(rows.map((tc) => ({
        ...tc,
        trueRoute: edges.get(tc.id)?.true ?? null,
        falseRoute: edges.get(tc.id)?.false ?? null,
        usedBy: usedByMap.get(tc.id) ?? [],
    })))

    if (!companyIds) await TimeConditionsCache.setAll(conditions)
    return conditions
}

export const getTimeConditionById = async (id: string): Promise<TimeConditionDto> => {
    const cached = await TimeConditionsCache.getTimeCondition(id)
    if (cached) return cached as TimeConditionDto

    const found = await prisma.timeCondition.findUnique({ where: { id }, select: timeConditionSelect })
    if (!found) throw new AppError('Time condition not found', 404)

    const [trueRoute, falseRoute, usedByMap] = await Promise.all([
        FlowEdgeRepository.getOne('timecondition', id, 'true'),
        FlowEdgeRepository.getOne('timecondition', id, 'false'),
        resolveUsedByLabels('timecondition', [id], found.companyId),
    ])
    const tc = (await withDestinationLabels([{ ...found, trueRoute, falseRoute, usedBy: usedByMap.get(id) ?? [] }]))[0]!
    await TimeConditionsCache.setTimeCondition(id, tc)
    return tc
}

export const createTimeCondition = async (data: CreateTimeConditionInput) => {
    await getCompanyById(data.companyId)

    const existing = await prisma.timeCondition.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Time condition already exists for this company', 409)

    await validateRoute(data.trueRoute, data.companyId, 'trueRoute')
    await validateRoute(data.falseRoute, data.companyId, 'falseRoute')

    const groupsWithRanges = data.groupIds.length > 0
        ? await prisma.timeGroup.findMany({
            where: { id: { in: data.groupIds }, companyId: data.companyId },
            include: { ranges: true },
        })
        : []

    if (data.groupIds.length > 0 && groupsWithRanges.length !== data.groupIds.length)
        throw new AppError('One or more time groups not found or belong to different company', 404)

    const tc = await prisma.$transaction(async (tx) => {
        const created = await tx.timeCondition.create({
            data: {
                name: data.name,
                companyId: data.companyId,
                timeGroups: data.groupIds.length > 0
                    ? { create: data.groupIds.map((gId) => ({ timeGroupId: gId })) }
                    : undefined,
            },
            select: timeConditionSelect,
        })
        await Promise.all([
            FlowEdgeRepository.setSlot(tx, data.companyId, 'timecondition', created.id, 'true', data.trueRoute ?? null),
            FlowEdgeRepository.setSlot(tx, data.companyId, 'timecondition', created.id, 'false', data.falseRoute ?? null),
        ])
        return created
    })

    try {
        await TimeConditionRepository.regenerate(data.companyId)
    } finally {
        await TimeConditionsCache.invalidateByCompany(data.companyId)
        await TimeConditionsCache.invalidateAll()
    }
    return { ...tc, trueRoute: data.trueRoute ?? null, falseRoute: data.falseRoute ?? null, usedBy: [] }
}

export const updateTimeCondition = async (id: string, data: UpdateTimeConditionInput) => {
    const existing = await prisma.timeCondition.findUnique({ where: { id } })
    if (!existing) throw new AppError('Time condition not found', 404)

    if (data.name && data.name !== existing.name) {
        const dup = await prisma.timeCondition.findUnique({
            where: { name_companyId: { name: data.name, companyId: existing.companyId } },
        })
        if (dup) throw new AppError('Time condition name already in use for this company', 409)
    }

    if (data.trueRoute !== undefined) await validateRoute(data.trueRoute, existing.companyId, 'trueRoute')
    if (data.falseRoute !== undefined) await validateRoute(data.falseRoute, existing.companyId, 'falseRoute')

    const tc = await prisma.$transaction(async (tx) => {
        const updated = await tx.timeCondition.update({
            where: { id },
            data: { name: data.name },
            select: timeConditionSelect,
        })
        await Promise.all([
            data.trueRoute !== undefined ? FlowEdgeRepository.setSlot(tx, existing.companyId, 'timecondition', id, 'true', data.trueRoute) : null,
            data.falseRoute !== undefined ? FlowEdgeRepository.setSlot(tx, existing.companyId, 'timecondition', id, 'false', data.falseRoute) : null,
        ])
        return updated
    })

    try {
        await TimeConditionRepository.regenerate(existing.companyId)
    } finally {
        await TimeConditionsCache.invalidateTimeCondition(id)
        await TimeConditionsCache.invalidateByCompany(existing.companyId)
        await TimeConditionsCache.invalidateAll()
    }
    const [trueRoute, falseRoute, usedByMap] = await Promise.all([
        data.trueRoute !== undefined ? data.trueRoute : FlowEdgeRepository.getOne('timecondition', id, 'true'),
        data.falseRoute !== undefined ? data.falseRoute : FlowEdgeRepository.getOne('timecondition', id, 'false'),
        resolveUsedByLabels('timecondition', [id], existing.companyId),
    ])
    return { ...tc, trueRoute, falseRoute, usedBy: usedByMap.get(id) ?? [] }
}

export const deleteTimeCondition = async (id: string) => {
    const existing = await prisma.timeCondition.findUnique({ where: { id } })
    if (!existing) throw new AppError('Time condition not found', 404)

    await assertNotReferenced('timecondition', id)

    await prisma.$transaction(async (tx) => {
        await tx.timeCondition.delete({ where: { id } })
        await FlowEdgeRepository.deleteAllForSource(tx, 'timecondition', id)
    })

    try {
        await TimeConditionRepository.regenerate(existing.companyId)
    } finally {
        await TimeConditionsCache.invalidateTimeCondition(id)
        await TimeConditionsCache.invalidateByCompany(existing.companyId)
        await TimeConditionsCache.invalidateAll()
    }
}
