import { prisma } from '../../lib/prisma'
import { TimeConditionsCache } from './cache/time-conditions.cache'
import type { CreateTimeConditionInput, UpdateTimeConditionInput, RouteDest } from './schemas/time-condition.schema'
import { TimeConditionRepository } from '../../asterisk/timecondition.repository'
import { AppError } from '../../utils/errors/app.error'

const timeConditionSelect = {
    id: true,
    name: true,
    companyId: true,
    trueRoute: true,
    falseRoute: true,
    timeGroups: {
        select: {
            timeGroup: { select: { id: true, name: true } },
        },
    },
    createdAt: true,
    updatedAt: true,
} as const

const _byId = () => prisma.timeCondition.findUnique({ where: { id: '' }, select: timeConditionSelect })
export type TimeConditionDto = NonNullable<Awaited<ReturnType<typeof _byId>>>

async function validateRoute(route: RouteDest | undefined | null, companyId: string, label: string) {
    if (!route || route.type === 'hangup') return

    switch (route.type) {
        case 'extension': {
            const ext = await prisma.extension.findUnique({ where: { id: route.id }, select: { companyId: true } })
            if (!ext) throw new AppError(`${label}: Extension not found`, 404)
            if (ext.companyId !== companyId) throw new AppError(`${label}: Extension belongs to different company`, 403)
            break
        }
        case 'queue': {
            const q = await prisma.queue.findUnique({ where: { id: route.id }, select: { companyId: true, number: true } })
            if (!q) throw new AppError(`${label}: Queue not found`, 404)
            if (q.companyId !== companyId) throw new AppError(`${label}: Queue belongs to different company`, 403)
            if (!q.number) throw new AppError(`${label}: Queue has no number — cannot use as route destination`, 400)
            break
        }
        case 'voicemail': {
            // voicemail id is free-form (extension number or user id) — no FK to validate
            break
        }
        case 'timecondition': {
            const tc = await prisma.timeCondition.findUnique({ where: { id: route.id }, select: { companyId: true } })
            if (!tc) throw new AppError(`${label}: Time condition not found`, 404)
            if (tc.companyId !== companyId) throw new AppError(`${label}: Time condition belongs to different company`, 403)
            break
        }
    }
}

async function loadRangesForCondition(tcId: string) {
    const groups = await prisma.timeConditionTimeGroup.findMany({
        where: { timeConditionId: tcId },
        include: { timeGroup: { include: { ranges: true } } },
    })
    return groups.flatMap((g) => g.timeGroup.ranges)
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export async function resyncTimeConditionDialplan(tx: Tx, tcId: string) {
    const tc = await tx.timeCondition.findUnique({
        where: { id: tcId },
        select: { name: true, trueRoute: true, falseRoute: true },
    })
    if (!tc) return

    const groups = await tx.timeConditionTimeGroup.findMany({
        where: { timeConditionId: tcId },
        include: { timeGroup: { include: { ranges: true } } },
    })
    const ranges = groups.flatMap((g) => g.timeGroup.ranges)

    await TimeConditionRepository.update(tx, tcId, tc.name, ranges, tc.trueRoute as RouteDest, tc.falseRoute as RouteDest)
}

export const getTimeConditionsByCompany = async (companyId: string) => {
    const cached = await TimeConditionsCache.getByCompany(companyId)
    if (cached) return cached

    const company = await prisma.company.findUnique({ where: { id: companyId } })
    if (!company) throw new AppError('Company not found', 404)

    const conditions = await prisma.timeCondition.findMany({ where: { companyId }, select: timeConditionSelect })
    await TimeConditionsCache.setByCompany(companyId, conditions)
    return conditions
}

export const getTimeConditionById = async (id: string): Promise<TimeConditionDto> => {
    const cached = await TimeConditionsCache.getTimeCondition(id)
    if (cached) return cached as TimeConditionDto

    const tc = await prisma.timeCondition.findUnique({ where: { id }, select: timeConditionSelect })
    if (!tc) throw new AppError('Time condition not found', 404)

    await TimeConditionsCache.setTimeCondition(id, tc)
    return tc
}

export const createTimeCondition = async (data: CreateTimeConditionInput) => {
    const company = await prisma.company.findUnique({ where: { id: data.companyId } })
    if (!company) throw new AppError('Company not found', 404)

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

    const ranges = groupsWithRanges.flatMap((g) => g.ranges)

    const tc = await prisma.$transaction(async (tx) => {
        const created = await tx.timeCondition.create({
            data: {
                name: data.name,
                companyId: data.companyId,
                trueRoute: data.trueRoute ?? undefined,
                falseRoute: data.falseRoute ?? undefined,
                timeGroups: data.groupIds.length > 0
                    ? { create: data.groupIds.map((gId) => ({ timeGroupId: gId })) }
                    : undefined,
            },
            select: timeConditionSelect,
        })

        await TimeConditionRepository.create(tx, created.id, created.name, ranges, data.trueRoute ?? null, data.falseRoute ?? null)

        return created
    })

    await TimeConditionsCache.invalidateByCompany(data.companyId)
    return tc
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

    const newTrue = data.trueRoute !== undefined ? data.trueRoute : (existing.trueRoute as RouteDest)
    const newFalse = data.falseRoute !== undefined ? data.falseRoute : (existing.falseRoute as RouteDest)
    const ranges = await loadRangesForCondition(id)

    const tc = await prisma.$transaction(async (tx) => {
        const updated = await tx.timeCondition.update({
            where: { id },
            data: {
                name: data.name,
                trueRoute: data.trueRoute === undefined ? undefined : (data.trueRoute ?? null),
                falseRoute: data.falseRoute === undefined ? undefined : (data.falseRoute ?? null),
            },
            select: timeConditionSelect,
        })

        await TimeConditionRepository.update(tx, id, updated.name, ranges, newTrue, newFalse)

        return updated
    })

    await TimeConditionsCache.invalidateTimeCondition(id)
    await TimeConditionsCache.invalidateByCompany(existing.companyId)
    return tc
}

export const deleteTimeCondition = async (id: string) => {
    const existing = await prisma.timeCondition.findUnique({ where: { id } })
    if (!existing) throw new AppError('Time condition not found', 404)

    await prisma.$transaction(async (tx) => {
        await TimeConditionRepository.delete(tx, id)
        await tx.timeCondition.delete({ where: { id } })
    })

    await TimeConditionsCache.invalidateTimeCondition(id)
    await TimeConditionsCache.invalidateByCompany(existing.companyId)
}
