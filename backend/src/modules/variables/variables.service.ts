import { Prisma } from '../../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { VariablesCache } from './cache/variables.cache'
import { VariableRepository } from '../../asterisk/variable.repository'
import { validateRouteDestination } from '../../schemas/route-destination.validate'
import type { CreateVariableSetInput, UpdateVariableSetInput } from './schemas/variable.schema'
import { AppError } from '../../utils/errors/app.error'

const select = {
    id: true,
    name: true,
    companyId: true,
    assignments: true,
    destination: true,
    createdAt: true,
    updatedAt: true,
} as const

export const getVariableSetsByCompany = async (companyId: string) => {
    const cached = await VariablesCache.getByCompany(companyId)
    if (cached) return cached

    await getCompanyById(companyId)

    const variableSets = await prisma.variableSet.findMany({ where: { companyId }, select })
    await VariablesCache.setByCompany(companyId, variableSets)
    return variableSets
}

export const getAllVariableSets = async (companyIds?: string[]) => {
    if (companyIds && companyIds.length === 0) return []

    if (!companyIds) {
        const cached = await VariablesCache.getAll()
        if (cached) return cached
    }

    const variableSets = await prisma.variableSet.findMany({
        where: companyIds ? { companyId: { in: companyIds } } : undefined,
        select,
    })

    if (!companyIds) await VariablesCache.setAll(variableSets)
    return variableSets
}

export const getVariableSetById = async (id: string) => {
    const cached = await VariablesCache.getVariableSet(id)
    if (cached) return cached

    const variableSet = await prisma.variableSet.findUnique({ where: { id }, select })
    if (!variableSet) throw new AppError('Variable set not found', 404)

    await VariablesCache.setVariableSet(id, variableSet)
    return variableSet
}

export const createVariableSet = async (data: CreateVariableSetInput) => {
    await getCompanyById(data.companyId)

    const existing = await prisma.variableSet.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Variable set already exists for this company', 409)

    await validateRouteDestination(data.destination ?? null, data.companyId)

    const variableSet = await prisma.$transaction(async (tx) => {
        const created = await tx.variableSet.create({
            data: {
                name: data.name,
                companyId: data.companyId,
                assignments: data.assignments,
                destination: data.destination ?? undefined,
            },
            select,
        })
        return created
    })

    try {
        await VariableRepository.regenerate(data.companyId)
    } finally {
        await VariablesCache.invalidateByCompany(data.companyId)
        await VariablesCache.invalidateAll()
    }
    return variableSet
}

export const updateVariableSet = async (id: string, data: UpdateVariableSetInput) => {
    const existing = await prisma.variableSet.findUnique({ where: { id } })
    if (!existing) throw new AppError('Variable set not found', 404)

    if (data.name !== undefined && data.name !== existing.name) {
        const conflict = await prisma.variableSet.findUnique({
            where: { name_companyId: { name: data.name, companyId: existing.companyId } },
        })
        if (conflict) throw new AppError('Variable set name already in use for this company', 409)
    }

    if (data.destination !== undefined) await validateRouteDestination(data.destination, existing.companyId)

    const variableSet = await prisma.$transaction(async (tx) => {
        const updated = await tx.variableSet.update({
            where: { id },
            data: {
                name: data.name,
                assignments: data.assignments,
                destination: data.destination === undefined ? undefined : (data.destination ?? Prisma.JsonNull),
            },
            select,
        })
        return updated
    })

    try {
        await VariableRepository.regenerate(existing.companyId)
    } finally {
        await VariablesCache.invalidateVariableSet(id)
        await VariablesCache.invalidateByCompany(existing.companyId)
        await VariablesCache.invalidateAll()
    }
    return variableSet
}

export const deleteVariableSet = async (id: string) => {
    const existing = await prisma.variableSet.findUnique({ where: { id }, select: { companyId: true } })
    if (!existing) throw new AppError('Variable set not found', 404)

    await prisma.$transaction(async (tx) => {
        await tx.variableSet.delete({ where: { id } })
    })

    try {
        await VariableRepository.regenerate(existing.companyId)
    } finally {
        await VariablesCache.invalidateVariableSet(id)
        await VariablesCache.invalidateByCompany(existing.companyId)
        await VariablesCache.invalidateAll()
    }
}
