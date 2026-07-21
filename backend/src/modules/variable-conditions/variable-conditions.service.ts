import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { VariableConditionsCache } from './cache/variable-conditions.cache'
import { VariableConditionRepository } from '../../asterisk/variablecondition.repository'
import { FlowEdgeRepository } from '../../asterisk/flow-edge.repository'
import { validateRouteDestination, assertNotReferenced } from '../../schemas/route-destination.validate'
import { resolveDestinationLabels, withDestinationLabel } from '../../schemas/route-destination-label'
import { resolveUsedByLabels, type UsedByRef } from '../../schemas/flow-reference-label'
import type { RouteDestination as RouteDest } from '../../schemas/route-destination.schema'
import type { CreateVariableConditionInput, UpdateVariableConditionInput } from './schemas/variable-condition.schema'
import { AppError } from '../../utils/errors/app.error'

const select = {
    id: true,
    name: true,
    companyId: true,
    combinator: true,
    rules: true,
    createdAt: true,
    updatedAt: true,
} as const

const _byId = () => prisma.variableCondition.findUnique({ where: { id: '' }, select })
export type VariableConditionDto = NonNullable<Awaited<ReturnType<typeof _byId>>> & { trueRoute: RouteDest; falseRoute: RouteDest; usedBy: UsedByRef[] }
type VariableConditionRow = NonNullable<Awaited<ReturnType<typeof _byId>>> & { trueRoute: RouteDest; falseRoute: RouteDest }

const validateRoute = (route: RouteDest | undefined | null, companyId: string, label: string) =>
    validateRouteDestination(route ?? null, companyId, label)

// Anexa o nome legível de trueRoute/falseRoute (resolvido no backend, cache-first — ver
// route-destination-label.ts). Agrupa por companyId — getAllVariableConditions pode misturar
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

// Resolve "usado por" em lote — agrupa por companyId pelo mesmo motivo de withDestinationLabels
// acima (getAllVariableConditions pode misturar empresas na mesma lista).
async function resolveUsedByLabelsBatched(rows: { id: string; companyId: string }[]): Promise<Map<string, UsedByRef[]>> {
    if (rows.length === 0) return new Map()
    const byCompany = new Map<string, string[]>()
    for (const r of rows) {
        const arr = byCompany.get(r.companyId) ?? []
        arr.push(r.id)
        byCompany.set(r.companyId, arr)
    }
    const maps = await Promise.all(
        [...byCompany.entries()].map(([companyId, ids]) => resolveUsedByLabels('variable-condition', ids, companyId)),
    )
    return new Map(maps.flatMap((m) => [...m]))
}

export const getVariableConditionsByCompany = async (companyId: string) => {
    let rows = (await VariableConditionsCache.getByCompany(companyId)) as VariableConditionRow[] | null
    if (!rows) {
        await getCompanyById(companyId)

        const [vcRows, edges] = await Promise.all([
            prisma.variableCondition.findMany({ where: { companyId }, select }),
            FlowEdgeRepository.getBySource(companyId, 'variablecondition'),
        ])
        rows = vcRows.map((vc) => ({ ...vc, trueRoute: edges.get(vc.id)?.true ?? null, falseRoute: edges.get(vc.id)?.false ?? null }))
        await VariableConditionsCache.setByCompany(companyId, rows)
    }

    const usedByMap = await resolveUsedByLabels('variable-condition', rows.map((vc) => vc.id), companyId)
    return withDestinationLabels(rows.map((vc) => ({ ...vc, usedBy: usedByMap.get(vc.id) ?? [] })))
}

export const getAllVariableConditions = async (companyIds?: string[]) => {
    if (companyIds && companyIds.length === 0) return []

    let rows = !companyIds ? ((await VariableConditionsCache.getAll()) as VariableConditionRow[] | null) : null
    if (!rows) {
        const vcRows = await prisma.variableCondition.findMany({
            where: companyIds ? { companyId: { in: companyIds } } : undefined,
            select,
        })
        const edges = await FlowEdgeRepository.getBySourceIds('variablecondition', vcRows.map((vc) => vc.id))
        rows = vcRows.map((vc) => ({ ...vc, trueRoute: edges.get(vc.id)?.true ?? null, falseRoute: edges.get(vc.id)?.false ?? null }))
        if (!companyIds) await VariableConditionsCache.setAll(rows)
    }

    const usedByMap = await resolveUsedByLabelsBatched(rows)
    return withDestinationLabels(rows.map((vc) => ({ ...vc, usedBy: usedByMap.get(vc.id) ?? [] })))
}

export const getVariableConditionById = async (id: string): Promise<VariableConditionDto> => {
    let row = (await VariableConditionsCache.getVariableCondition(id)) as VariableConditionRow | null
    if (!row) {
        const found = await prisma.variableCondition.findUnique({ where: { id }, select })
        if (!found) throw new AppError('Variable condition not found', 404)

        const [trueRoute, falseRoute] = await Promise.all([
            FlowEdgeRepository.getOne('variablecondition', id, 'true'),
            FlowEdgeRepository.getOne('variablecondition', id, 'false'),
        ])
        row = { ...found, trueRoute, falseRoute }
        await VariableConditionsCache.setVariableCondition(id, row)
    }

    const usedByMap = await resolveUsedByLabels('variable-condition', [id], row.companyId)
    return (await withDestinationLabels([{ ...row, usedBy: usedByMap.get(id) ?? [] }]))[0]!
}

export const createVariableCondition = async (data: CreateVariableConditionInput) => {
    await getCompanyById(data.companyId)

    const existing = await prisma.variableCondition.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Variable condition already exists for this company', 409)

    await validateRoute(data.trueRoute, data.companyId, 'trueRoute')
    await validateRoute(data.falseRoute, data.companyId, 'falseRoute')

    const variableCondition = await prisma.$transaction(async (tx) => {
        const created = await tx.variableCondition.create({
            data: {
                name: data.name,
                companyId: data.companyId,
                combinator: data.combinator,
                rules: data.rules,
            },
            select,
        })
        await Promise.all([
            FlowEdgeRepository.setSlot(tx, data.companyId, 'variablecondition', created.id, 'true', data.trueRoute ?? null),
            FlowEdgeRepository.setSlot(tx, data.companyId, 'variablecondition', created.id, 'false', data.falseRoute ?? null),
        ])
        return created
    })

    try {
        await VariableConditionRepository.regenerate(data.companyId)
    } finally {
        await VariableConditionsCache.invalidateByCompany(data.companyId)
        await VariableConditionsCache.invalidateAll()
    }
    return { ...variableCondition, trueRoute: data.trueRoute ?? null, falseRoute: data.falseRoute ?? null, usedBy: [] }
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

    if (data.trueRoute !== undefined) await validateRoute(data.trueRoute, existing.companyId, 'trueRoute')
    if (data.falseRoute !== undefined) await validateRoute(data.falseRoute, existing.companyId, 'falseRoute')

    const variableCondition = await prisma.$transaction(async (tx) => {
        const updated = await tx.variableCondition.update({
            where: { id },
            data: {
                name: data.name,
                combinator: data.combinator,
                rules: data.rules,
            },
            select,
        })
        await Promise.all([
            data.trueRoute !== undefined ? FlowEdgeRepository.setSlot(tx, existing.companyId, 'variablecondition', id, 'true', data.trueRoute) : null,
            data.falseRoute !== undefined ? FlowEdgeRepository.setSlot(tx, existing.companyId, 'variablecondition', id, 'false', data.falseRoute) : null,
        ])
        return updated
    })

    try {
        await VariableConditionRepository.regenerate(existing.companyId)
    } finally {
        await VariableConditionsCache.invalidateVariableCondition(id)
        await VariableConditionsCache.invalidateByCompany(existing.companyId)
        await VariableConditionsCache.invalidateAll()
    }
    const [trueRoute, falseRoute, usedByMap] = await Promise.all([
        data.trueRoute !== undefined ? data.trueRoute : FlowEdgeRepository.getOne('variablecondition', id, 'true'),
        data.falseRoute !== undefined ? data.falseRoute : FlowEdgeRepository.getOne('variablecondition', id, 'false'),
        resolveUsedByLabels('variable-condition', [id], existing.companyId),
    ])
    return { ...variableCondition, trueRoute, falseRoute, usedBy: usedByMap.get(id) ?? [] }
}

export const deleteVariableCondition = async (id: string) => {
    const existing = await prisma.variableCondition.findUnique({ where: { id }, select: { companyId: true } })
    if (!existing) throw new AppError('Variable condition not found', 404)

    await assertNotReferenced('variable-condition', id)

    await prisma.$transaction(async (tx) => {
        await tx.variableCondition.delete({ where: { id } })
        await FlowEdgeRepository.deleteAllForSource(tx, 'variablecondition', id)
    })

    try {
        await VariableConditionRepository.regenerate(existing.companyId)
    } finally {
        await VariableConditionsCache.invalidateVariableCondition(id)
        await VariableConditionsCache.invalidateByCompany(existing.companyId)
        await VariableConditionsCache.invalidateAll()
    }
}
