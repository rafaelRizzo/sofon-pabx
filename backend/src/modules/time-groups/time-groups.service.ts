import { prisma } from '../../lib/prisma'
import { TimeGroupsCache } from './cache/time-groups.cache'
import type { CreateTimeGroupInput, UpdateTimeGroupInput } from './schemas/time-group.schema'
import { AppError } from '../../utils/errors/app.error'

const timeGroupSelect = {
    id: true,
    name: true,
    companyId: true,
    ranges: {
        select: { id: true, startTime: true, endTime: true, weekdays: true, monthdays: true, months: true, createdAt: true },
    },
    createdAt: true,
    updatedAt: true,
} as const

const _byId = () => prisma.timeGroup.findUnique({ where: { id: '' }, select: timeGroupSelect })
export type TimeGroupDto = NonNullable<Awaited<ReturnType<typeof _byId>>>

export const getTimeGroupsByCompany = async (companyId: string) => {
    const cached = await TimeGroupsCache.getByCompany(companyId)
    if (cached) return cached

    const company = await prisma.company.findUnique({ where: { id: companyId } })
    if (!company) throw new AppError('Company not found', 404)

    const groups = await prisma.timeGroup.findMany({ where: { companyId }, select: timeGroupSelect })
    await TimeGroupsCache.setByCompany(companyId, groups)
    return groups
}

export const getTimeGroupById = async (id: string): Promise<TimeGroupDto> => {
    const cached = await TimeGroupsCache.getTimeGroup(id)
    if (cached) return cached as TimeGroupDto

    const group = await prisma.timeGroup.findUnique({ where: { id }, select: timeGroupSelect })
    if (!group) throw new AppError('Time group not found', 404)

    await TimeGroupsCache.setTimeGroup(id, group)
    return group
}

export const createTimeGroup = async (data: CreateTimeGroupInput) => {
    const company = await prisma.company.findUnique({ where: { id: data.companyId } })
    if (!company) throw new AppError('Company not found', 404)

    const existing = await prisma.timeGroup.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Time group already exists for this company', 409)

    const group = await prisma.timeGroup.create({
        data: {
            name: data.name,
            companyId: data.companyId,
            ranges: { create: data.ranges },
        },
        select: timeGroupSelect,
    })

    await TimeGroupsCache.invalidateByCompany(data.companyId)
    await TimeGroupsCache.invalidateAll()
    return group
}

export const updateTimeGroup = async (id: string, data: UpdateTimeGroupInput) => {
    const existing = await prisma.timeGroup.findUnique({ where: { id } })
    if (!existing) throw new AppError('Time group not found', 404)

    if (data.name && data.name !== existing.name) {
        const dup = await prisma.timeGroup.findUnique({
            where: { name_companyId: { name: data.name, companyId: existing.companyId } },
        })
        if (dup) throw new AppError('Time group name already in use for this company', 409)
    }

    const group = await prisma.$transaction(async (tx) => {
        if (data.ranges) {
            await tx.timeRange.deleteMany({ where: { timeGroupId: id } })
            await tx.timeRange.createMany({ data: data.ranges.map((r) => ({ ...r, timeGroupId: id })) })
        }
        return tx.timeGroup.update({
            where: { id },
            data: { name: data.name },
            select: timeGroupSelect,
        })
    })

    await TimeGroupsCache.invalidateTimeGroup(id)
    await TimeGroupsCache.invalidateByCompany(existing.companyId)
    await TimeGroupsCache.invalidateAll()
    return group
}

export const deleteTimeGroup = async (id: string) => {
    const existing = await prisma.timeGroup.findUnique({ where: { id } })
    if (!existing) throw new AppError('Time group not found', 404)

    await prisma.timeGroup.delete({ where: { id } })

    await TimeGroupsCache.invalidateTimeGroup(id)
    await TimeGroupsCache.invalidateByCompany(existing.companyId)
    await TimeGroupsCache.invalidateAll()
}
