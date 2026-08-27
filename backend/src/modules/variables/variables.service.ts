import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { VariablesCache } from './cache/variables.cache'
import { VariableRepository } from '../../asterisk/variable.repository'
import { FlowEdgeRepository } from '../../asterisk/flow-edge.repository'
import { syncFlowNodeLabel } from '../flows/flow-nodes.service'
import { validateRouteDestination, assertNotReferenced } from '../../schemas/route-destination.validate'
import { resolveDestinationLabels, withDestinationLabel } from '../../schemas/route-destination-label'
import { resolveUsedByLabels, type UsedByRef } from '../../schemas/flow-reference-label'
import type { RouteDestination } from '../../schemas/route-destination.schema'
import type { CreateVariableSetInput, UpdateVariableSetInput } from './schemas/variable.schema'
import { AppError } from '../../utils/errors/app.error'

const select = {
    id: true,
    name: true,
    companyId: true,
    assignments: true,
    createdAt: true,
    updatedAt: true,
} as const

const _byId = () => prisma.variableSet.findUnique({ where: { id: '' }, select })
type VariableSetRow = NonNullable<Awaited<ReturnType<typeof _byId>>> & { destination: RouteDestination }

// Anexa o nome legível do destino (resolvido no backend, cache-first - ver route-destination-label.ts)
// pra a badge do frontend não precisar buscar/mapear id->nome ela mesma. Agrupa por companyId -
// getAllVariableSets pode misturar empresas diferentes na mesma lista (visão admin).
async function withDestinationLabels<T extends { destination: unknown; companyId: string }>(sets: T[]): Promise<T[]> {
    if (sets.length === 0) return sets
    const byCompany = new Map<string, RouteDestination[]>()
    for (const s of sets) {
        const arr = byCompany.get(s.companyId) ?? []
        arr.push(s.destination as RouteDestination)
        byCompany.set(s.companyId, arr)
    }
    const labelMaps = new Map(
        await Promise.all([...byCompany.entries()].map(async ([companyId, dests]) => [companyId, await resolveDestinationLabels(dests, companyId)] as const)),
    )
    return sets.map((s) => ({ ...s, destination: withDestinationLabel(s.destination as RouteDestination, labelMaps.get(s.companyId)!) }))
}

// Resolve o indicador "usado por" em lote, agrupando por companyId - resolveUsedByLabels só aceita
// uma empresa por chamada (mesma razão de withDestinationLabels acima: getAllVariableSets pode
// misturar empresas diferentes na mesma lista, visão admin).
async function withUsedBy<T extends { id: string; companyId: string }>(sets: T[]): Promise<Map<string, UsedByRef[]>> {
    if (sets.length === 0) return new Map()
    const byCompany = new Map<string, string[]>()
    for (const s of sets) {
        const arr = byCompany.get(s.companyId) ?? []
        arr.push(s.id)
        byCompany.set(s.companyId, arr)
    }
    const maps = await Promise.all(
        [...byCompany.entries()].map(([companyId, ids]) => resolveUsedByLabels('variable-set', ids, companyId)),
    )
    const merged = new Map<string, UsedByRef[]>()
    for (const m of maps) for (const [k, v] of m) merged.set(k, v)
    return merged
}

export const getVariableSetsByCompany = async (companyId: string) => {
    let rows = (await VariablesCache.getByCompany(companyId)) as VariableSetRow[] | null
    if (!rows) {
        await getCompanyById(companyId)

        const [vsRows, edges] = await Promise.all([
            prisma.variableSet.findMany({ where: { companyId }, select }),
            FlowEdgeRepository.getBySource(companyId, 'variableset'),
        ])
        rows = vsRows.map((s) => ({ ...s, destination: edges.get(s.id)?.default ?? null }))
        await VariablesCache.setByCompany(companyId, rows)
    }

    const usedByMap = await resolveUsedByLabels('variable-set', rows.map((s) => s.id), companyId)
    return withDestinationLabels(rows.map((s) => ({ ...s, usedBy: usedByMap.get(s.id) ?? [] })))
}

export const getAllVariableSets = async (companyIds?: string[]) => {
    if (companyIds && companyIds.length === 0) return []

    let rows = !companyIds ? ((await VariablesCache.getAll()) as VariableSetRow[] | null) : null
    if (!rows) {
        const vsRows = await prisma.variableSet.findMany({
            where: companyIds ? { companyId: { in: companyIds } } : undefined,
            select,
        })
        const edges = await FlowEdgeRepository.getBySourceIds('variableset', vsRows.map((s) => s.id))
        rows = vsRows.map((s) => ({ ...s, destination: edges.get(s.id)?.default ?? null }))
        if (!companyIds) await VariablesCache.setAll(rows)
    }

    const usedByMap = await withUsedBy(rows)
    return withDestinationLabels(rows.map((s) => ({ ...s, usedBy: usedByMap.get(s.id) ?? [] })))
}

export const getVariableSetById = async (id: string) => {
    let row = (await VariablesCache.getVariableSet(id)) as VariableSetRow | null
    if (!row) {
        const found = await prisma.variableSet.findUnique({ where: { id }, select })
        if (!found) throw new AppError('Variable set not found', 404)

        const destination = await FlowEdgeRepository.getOne('variableset', id, 'default')
        row = { ...found, destination }
        await VariablesCache.setVariableSet(id, row)
    }

    const usedByMap = await resolveUsedByLabels('variable-set', [id], row.companyId)
    return (await withDestinationLabels([{ ...row, usedBy: usedByMap.get(id) ?? [] }]))[0]!
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
            },
            select,
        })
        await FlowEdgeRepository.setSlot(tx, data.companyId, 'variableset', created.id, 'default', data.destination ?? null)
        return created
    })

    try {
        await VariableRepository.regenerate(data.companyId)
    } finally {
        await VariablesCache.invalidateByCompany(data.companyId)
        await VariablesCache.invalidateAll()
    }
    return { ...variableSet, destination: data.destination ?? null, usedBy: [] }
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
            },
            select,
        })
        if (data.destination !== undefined) {
            await FlowEdgeRepository.setSlot(tx, existing.companyId, 'variableset', id, 'default', data.destination)
        }
        return updated
    })

    if (data.name !== undefined && data.name !== existing.name)
        await syncFlowNodeLabel('variable-set', id, data.name)

    try {
        await VariableRepository.regenerate(existing.companyId)
    } finally {
        await VariablesCache.invalidateVariableSet(id)
        await VariablesCache.invalidateByCompany(existing.companyId)
        await VariablesCache.invalidateAll()
    }
    const [destination, usedByMap] = await Promise.all([
        data.destination !== undefined ? data.destination : FlowEdgeRepository.getOne('variableset', id, 'default'),
        resolveUsedByLabels('variable-set', [id], existing.companyId),
    ])
    return { ...variableSet, destination, usedBy: usedByMap.get(id) ?? [] }
}

export const deleteVariableSet = async (id: string) => {
    const existing = await prisma.variableSet.findUnique({ where: { id }, select: { companyId: true } })
    if (!existing) throw new AppError('Variable set not found', 404)

    await assertNotReferenced('variable-set', id)

    await prisma.$transaction(async (tx) => {
        await tx.variableSet.delete({ where: { id } })
        await FlowEdgeRepository.deleteAllForSource(tx, 'variableset', id)
    })

    try {
        await VariableRepository.regenerate(existing.companyId)
    } finally {
        await VariablesCache.invalidateVariableSet(id)
        await VariablesCache.invalidateByCompany(existing.companyId)
        await VariablesCache.invalidateAll()
    }
}
