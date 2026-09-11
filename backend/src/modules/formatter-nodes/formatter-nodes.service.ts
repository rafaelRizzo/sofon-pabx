import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { FormatterNodesCache } from './cache/formatter-nodes.cache'
import { FormatterNodeRepository } from '../../asterisk/destinations/formatter-node.repository'
import { FlowEdgeRepository } from '../../asterisk/flows/flow-edge.repository'
import { syncFlowNodeLabel } from '../flows/flow-nodes.service'
import { validateRouteDestination, assertNotReferenced } from '../../schemas/route-destination.validate'
import { resolveDestinationLabels, withDestinationLabel } from '../../schemas/route-destination-label'
import { resolveUsedByLabels, type UsedByRef } from '../../schemas/flow-reference-label'
import type { RouteDestination } from '../../schemas/route-destination.schema'
import type { CreateFormatterNodeInput, UpdateFormatterNodeInput } from './schemas/formatter-node.schema'
import { AppError } from '../../utils/errors/app.error'

const select = {
    id: true,
    name: true,
    companyId: true,
    inputVariable: true,
    outputVariable: true,
    masks: true,
    createdAt: true,
    updatedAt: true,
} as const

const _byId = () => prisma.formatterNode.findUnique({ where: { id: '' }, select })
export type FormatterNodeDto = NonNullable<Awaited<ReturnType<typeof _byId>>> & { onSuccess: RouteDestination; onError: RouteDestination; usedBy: UsedByRef[] }
type FormatterNodeRow = NonNullable<Awaited<ReturnType<typeof _byId>>> & { onSuccess: RouteDestination; onError: RouteDestination }

const validateDest = (dest: RouteDestination | undefined | null, companyId: string, label: string) =>
    validateRouteDestination(dest ?? null, companyId, label)

async function withDestinationLabels<T extends { onSuccess: unknown; onError: unknown; companyId: string }>(nodes: T[]): Promise<T[]> {
    if (nodes.length === 0) return nodes
    const byCompany = new Map<string, RouteDestination[]>()
    for (const n of nodes) {
        const arr = byCompany.get(n.companyId) ?? []
        arr.push(n.onSuccess as RouteDestination, n.onError as RouteDestination)
        byCompany.set(n.companyId, arr)
    }
    const labelMaps = new Map(
        await Promise.all([...byCompany.entries()].map(async ([companyId, dests]) => [companyId, await resolveDestinationLabels(dests, companyId)] as const)),
    )
    return nodes.map((n) => {
        const labelMap = labelMaps.get(n.companyId)!
        return {
            ...n,
            onSuccess: withDestinationLabel(n.onSuccess as RouteDestination, labelMap),
            onError: withDestinationLabel(n.onError as RouteDestination, labelMap),
        }
    })
}

async function withUsedBy<T extends { id: string; companyId: string }>(nodes: T[]): Promise<(T & { usedBy: UsedByRef[] })[]> {
    if (nodes.length === 0) return []
    const byCompany = new Map<string, string[]>()
    for (const n of nodes) {
        const ids = byCompany.get(n.companyId) ?? []
        ids.push(n.id)
        byCompany.set(n.companyId, ids)
    }
    const usedByMaps = await Promise.all(
        [...byCompany.entries()].map(([companyId, ids]) => resolveUsedByLabels('formatter', ids, companyId)),
    )
    const merged = new Map<string, UsedByRef[]>()
    for (const map of usedByMaps) for (const [id, refs] of map) merged.set(id, refs)
    return nodes.map((n) => ({ ...n, usedBy: merged.get(n.id) ?? [] }))
}

export const getAllFormatterNodes = async (companyIds?: string[]) => {
    if (companyIds && companyIds.length === 0) return []

    let rows = !companyIds ? ((await FormatterNodesCache.getAll()) as FormatterNodeRow[] | null) : null
    if (!rows) {
        const nodeRows = await prisma.formatterNode.findMany({
            where: companyIds ? { companyId: { in: companyIds } } : undefined,
            select,
        })
        const edges = await FlowEdgeRepository.getBySourceIds('formatternode', nodeRows.map((n) => n.id))
        rows = nodeRows.map((n) => ({ ...n, masks: n.masks as string[], onSuccess: edges.get(n.id)?.success ?? null, onError: edges.get(n.id)?.error ?? null }))
        if (!companyIds) await FormatterNodesCache.setAll(rows)
    }

    return withUsedBy(await withDestinationLabels(rows))
}

export const getFormatterNodesByCompany = async (companyId: string) => {
    let rows = (await FormatterNodesCache.getByCompany(companyId)) as FormatterNodeRow[] | null
    if (!rows) {
        await getCompanyById(companyId)

        const [nodeRows, edges] = await Promise.all([
            prisma.formatterNode.findMany({ where: { companyId }, select }),
            FlowEdgeRepository.getBySource(companyId, 'formatternode'),
        ])
        rows = nodeRows.map((n) => ({ ...n, masks: n.masks as string[], onSuccess: edges.get(n.id)?.success ?? null, onError: edges.get(n.id)?.error ?? null }))
        await FormatterNodesCache.setByCompany(companyId, rows)
    }

    const usedByMap = await resolveUsedByLabels('formatter', rows.map((n) => n.id), companyId)
    return withDestinationLabels(rows.map((n) => ({ ...n, usedBy: usedByMap.get(n.id) ?? [] })))
}

export const getFormatterNodeById = async (id: string) => {
    let row = (await FormatterNodesCache.getNode(id)) as FormatterNodeRow | null
    if (!row) {
        const found = await prisma.formatterNode.findUnique({ where: { id }, select })
        if (!found) throw new AppError('Formatter node not found', 404)

        const [onSuccess, onError] = await Promise.all([
            FlowEdgeRepository.getOne('formatternode', id, 'success'),
            FlowEdgeRepository.getOne('formatternode', id, 'error'),
        ])
        row = { ...found, masks: found.masks as string[], onSuccess, onError }
        await FormatterNodesCache.setNode(id, row)
    }

    const usedByMap = await resolveUsedByLabels('formatter', [id], row.companyId)
    return (await withDestinationLabels([{ ...row, usedBy: usedByMap.get(id) ?? [] }]))[0]!
}

export const createFormatterNode = async (data: CreateFormatterNodeInput) => {
    await getCompanyById(data.companyId)

    const existing = await prisma.formatterNode.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Formatter node already exists for this company', 409)

    await validateDest(data.onSuccess, data.companyId, 'onSuccess')
    await validateDest(data.onError, data.companyId, 'onError')

    const node = await prisma.$transaction(async (tx) => {
        const created = await tx.formatterNode.create({
            data: {
                name: data.name,
                companyId: data.companyId,
                inputVariable: data.inputVariable,
                outputVariable: data.outputVariable,
                masks: data.masks,
            },
            select,
        })
        await Promise.all([
            FlowEdgeRepository.setSlot(tx, data.companyId, 'formatternode', created.id, 'success', data.onSuccess ?? null),
            FlowEdgeRepository.setSlot(tx, data.companyId, 'formatternode', created.id, 'error', data.onError ?? null),
        ])
        return created
    })

    try {
        await FormatterNodeRepository.regenerate(data.companyId)
    } finally {
        await FormatterNodesCache.invalidateByCompany(data.companyId)
        await FormatterNodesCache.invalidateAll()
    }
    return { ...node, masks: node.masks as string[], onSuccess: data.onSuccess ?? null, onError: data.onError ?? null, usedBy: [] }
}

export const updateFormatterNode = async (id: string, data: UpdateFormatterNodeInput) => {
    const existing = await prisma.formatterNode.findUnique({ where: { id } })
    if (!existing) throw new AppError('Formatter node not found', 404)

    if (data.name && data.name !== existing.name) {
        const conflict = await prisma.formatterNode.findUnique({
            where: { name_companyId: { name: data.name, companyId: existing.companyId } },
        })
        if (conflict) throw new AppError('Formatter node already exists for this company', 409)
    }

    if (data.onSuccess !== undefined) await validateDest(data.onSuccess, existing.companyId, 'onSuccess')
    if (data.onError !== undefined) await validateDest(data.onError, existing.companyId, 'onError')

    const node = await prisma.$transaction(async (tx) => {
        const updated = await tx.formatterNode.update({
            where: { id },
            data: {
                name: data.name,
                inputVariable: data.inputVariable,
                outputVariable: data.outputVariable,
                masks: data.masks,
            },
            select,
        })
        await Promise.all([
            data.onSuccess !== undefined ? FlowEdgeRepository.setSlot(tx, existing.companyId, 'formatternode', id, 'success', data.onSuccess) : null,
            data.onError !== undefined ? FlowEdgeRepository.setSlot(tx, existing.companyId, 'formatternode', id, 'error', data.onError) : null,
        ])
        return updated
    })

    if (data.name && data.name !== existing.name) await syncFlowNodeLabel('formatter', id, data.name)

    try {
        await FormatterNodeRepository.regenerate(existing.companyId)
    } finally {
        await FormatterNodesCache.invalidateNode(id)
        await FormatterNodesCache.invalidateAgiNode(id)
        await FormatterNodesCache.invalidateByCompany(existing.companyId)
        await FormatterNodesCache.invalidateAll()
    }

    const [onSuccess, onError, usedByMap] = await Promise.all([
        data.onSuccess !== undefined ? data.onSuccess : FlowEdgeRepository.getOne('formatternode', id, 'success'),
        data.onError !== undefined ? data.onError : FlowEdgeRepository.getOne('formatternode', id, 'error'),
        resolveUsedByLabels('formatter', [id], existing.companyId),
    ])
    return { ...node, masks: node.masks as string[], onSuccess, onError, usedBy: usedByMap.get(id) ?? [] }
}

export const deleteFormatterNode = async (id: string) => {
    const existing = await prisma.formatterNode.findUnique({ where: { id } })
    if (!existing) throw new AppError('Formatter node not found', 404)

    await assertNotReferenced('formatter', id)

    await prisma.$transaction(async (tx) => {
        await tx.formatterNode.delete({ where: { id } })
        await FlowEdgeRepository.deleteAllForSource(tx, 'formatternode', id)
    })

    try {
        await FormatterNodeRepository.regenerate(existing.companyId)
    } finally {
        await FormatterNodesCache.invalidateNode(id)
        await FormatterNodesCache.invalidateAgiNode(id)
        await FormatterNodesCache.invalidateByCompany(existing.companyId)
        await FormatterNodesCache.invalidateAll()
    }
}
