import { Prisma } from '../../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { TimeConditionsCache } from './cache/time-conditions.cache'
import type { CreateTimeConditionInput, UpdateTimeConditionInput, RouteDest } from './schemas/time-condition.schema'
import { TimeConditionRepository } from '../../asterisk/timecondition.repository'
import { validateRouteDestination } from '../../schemas/route-destination.validate'
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

const validateRoute = (route: RouteDest | undefined | null, companyId: string, label: string) =>
    validateRouteDestination(route ?? null, companyId, label)

export const getTimeConditionsByCompany = async (companyId: string) => {
    const cached = await TimeConditionsCache.getByCompany(companyId)
    if (cached) return cached

    await getCompanyById(companyId)

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
                trueRoute: data.trueRoute ?? undefined,
                falseRoute: data.falseRoute ?? undefined,
                timeGroups: data.groupIds.length > 0
                    ? { create: data.groupIds.map((gId) => ({ timeGroupId: gId })) }
                    : undefined,
            },
            select: timeConditionSelect,
        })

        return created
    })

    await TimeConditionRepository.regenerate(data.companyId)
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

    const tc = await prisma.$transaction(async (tx) => {
        const updated = await tx.timeCondition.update({
            where: { id },
            data: {
                name: data.name,
                trueRoute: data.trueRoute === undefined ? undefined : (data.trueRoute ?? Prisma.JsonNull),
                falseRoute: data.falseRoute === undefined ? undefined : (data.falseRoute ?? Prisma.JsonNull),
            },
            select: timeConditionSelect,
        })

        return updated
    })

    await TimeConditionRepository.regenerate(existing.companyId)
    await TimeConditionsCache.invalidateTimeCondition(id)
    await TimeConditionsCache.invalidateByCompany(existing.companyId)
    return tc
}

export const deleteTimeCondition = async (id: string) => {
    const existing = await prisma.timeCondition.findUnique({ where: { id } })
    if (!existing) throw new AppError('Time condition not found', 404)

    await prisma.$transaction(async (tx) => {
        await tx.timeCondition.delete({ where: { id } })
    })

    await TimeConditionRepository.regenerate(existing.companyId)
    await TimeConditionsCache.invalidateTimeCondition(id)
    await TimeConditionsCache.invalidateByCompany(existing.companyId)
}
