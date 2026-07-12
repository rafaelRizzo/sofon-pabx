import { Prisma } from '../../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { VariableConditionsCache } from './cache/variable-conditions.cache'
import { VariableConditionRepository } from '../../asterisk/variablecondition.repository'
import { validateRouteDestination } from '../../schemas/route-destination.validate'
import type { CreateVariableConditionInput, UpdateVariableConditionInput } from './schemas/variable-condition.schema'
import { AppError } from '../../utils/errors/app.error'

const select = {
    id: true,
    name: true,
    companyId: true,
    combinator: true,
    rules: true,
    trueRoute: true,
    falseRoute: true,
    createdAt: true,
    updatedAt: true,
} as const

export const getVariableConditionsByCompany = async (companyId: string) => {
    const cached = await VariableConditionsCache.getByCompany(companyId)
    if (cached) return cached

    await getCompanyById(companyId)

    const variableConditions = await prisma.variableCondition.findMany({ where: { companyId }, select })
    await VariableConditionsCache.setByCompany(companyId, variableConditions)
    return variableConditions
}

export const getAllVariableConditions = async (companyIds?: string[]) => {
    if (companyIds && companyIds.length === 0) return []

    if (!companyIds) {
        const cached = await VariableConditionsCache.getAll()
        if (cached) return cached
    }

    const variableConditions = await prisma.variableCondition.findMany({
        where: companyIds ? { companyId: { in: companyIds } } : undefined,
        select,
    })

    if (!companyIds) await VariableConditionsCache.setAll(variableConditions)
    return variableConditions
}

export const getVariableConditionById = async (id: string) => {
    const cached = await VariableConditionsCache.getVariableCondition(id)
    if (cached) return cached

    const variableCondition = await prisma.variableCondition.findUnique({ where: { id }, select })
    if (!variableCondition) throw new AppError('Variable condition not found', 404)

    await VariableConditionsCache.setVariableCondition(id, variableCondition)
    return variableCondition
}

export const createVariableCondition = async (data: CreateVariableConditionInput) => {
    await getCompanyById(data.companyId)

    const existing = await prisma.variableCondition.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Variable condition already exists for this company', 409)

    await validateRouteDestination(data.trueRoute ?? null, data.companyId, 'trueRoute')
    await validateRouteDestination(data.falseRoute ?? null, data.companyId, 'falseRoute')

    const variableCondition = await prisma.$transaction(async (tx) => {
        const created = await tx.variableCondition.create({
            data: {
                name: data.name,
                companyId: data.companyId,
                combinator: data.combinator,
                rules: data.rules,
                trueRoute: data.trueRoute ?? undefined,
                falseRoute: data.falseRoute ?? undefined,
            },
            select,
        })
        return created
    })

    try {
        await VariableConditionRepository.regenerate(data.companyId)
    } finally {
        await VariableConditionsCache.invalidateByCompany(data.companyId)
        await VariableConditionsCache.invalidateAll()
    }
    return variableCondition
}

export const updateVariableCondition = async (id: string, data: UpdateVariableConditionInput) => {
    const existing = await prisma.variableCondition.findUnique({ where: { id } })
    if (!existing) throw new AppError('Variable condition not found', 404)

    if (data.name !== undefined && data.name !== existing.name) {
        const conflict = await prisma.variableCondition.findUnique({
            where: { name_companyId: { name: data.name, companyId: existing.companyId } },
        })
        if (conflict) throw new AppError('Variable condition name already in use for this company', 409)
    }

    if (data.trueRoute !== undefined) await validateRouteDestination(data.trueRoute, existing.companyId, 'trueRoute')
    if (data.falseRoute !== undefined) await validateRouteDestination(data.falseRoute, existing.companyId, 'falseRoute')

    const variableCondition = await prisma.$transaction(async (tx) => {
        const updated = await tx.variableCondition.update({
            where: { id },
            data: {
                name: data.name,
                combinator: data.combinator,
                rules: data.rules,
                trueRoute: data.trueRoute === undefined ? undefined : (data.trueRoute ?? Prisma.JsonNull),
                falseRoute: data.falseRoute === undefined ? undefined : (data.falseRoute ?? Prisma.JsonNull),
            },
            select,
        })
        return updated
    })

    try {
        await VariableConditionRepository.regenerate(existing.companyId)
    } finally {
        await VariableConditionsCache.invalidateVariableCondition(id)
        await VariableConditionsCache.invalidateByCompany(existing.companyId)
        await VariableConditionsCache.invalidateAll()
    }
    return variableCondition
}

export const deleteVariableCondition = async (id: string) => {
    const existing = await prisma.variableCondition.findUnique({ where: { id }, select: { companyId: true } })
    if (!existing) throw new AppError('Variable condition not found', 404)

    await prisma.$transaction(async (tx) => {
        await tx.variableCondition.delete({ where: { id } })
    })

    try {
        await VariableConditionRepository.regenerate(existing.companyId)
    } finally {
        await VariableConditionsCache.invalidateVariableCondition(id)
        await VariableConditionsCache.invalidateByCompany(existing.companyId)
        await VariableConditionsCache.invalidateAll()
    }
}
