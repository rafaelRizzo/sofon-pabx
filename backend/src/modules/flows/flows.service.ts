import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { FlowsCache } from './cache/flows.cache'
import { FlowRepository } from '../../asterisk/flow.repository'
import { FlowEdgeRepository, type FlowSourceType } from '../../asterisk/flow-edge.repository'
import { validateRouteDestination, assertNotReferenced } from '../../schemas/route-destination.validate'
import { resolveDestinationLabels, withDestinationLabel } from '../../schemas/route-destination-label'
import { resolveUsedByLabels, type UsedByRef } from '../../schemas/flow-reference-label'
import type { RouteDestination } from '../../schemas/route-destination.schema'
import type { CreateFlowInput, UpdateFlowInput, UpdateFlowLayoutInput } from './schemas/flow.schema'
import { AppError } from '../../utils/errors/app.error'

const select = {
    id: true,
    name: true,
    companyId: true,
    layout: true,
    createdAt: true,
    updatedAt: true,
} as const

const toDto = <T extends { entryDestination: RouteDestination; usedBy: UsedByRef[] }>(f: T) => f

// Anexa o nome legível de entryDestination (resolvido no backend, cache-first — ver
// route-destination-label.ts). Todas as chamadas aqui são de uma única empresa por vez.
async function withDestinationLabels<T extends { entryDestination: unknown }>(flows: T[], companyId: string): Promise<T[]> {
    if (flows.length === 0) return flows
    const labelMap = await resolveDestinationLabels(flows.map((f) => f.entryDestination as RouteDestination), companyId)
    return flows.map((f) => ({ ...f, entryDestination: withDestinationLabel(f.entryDestination as RouteDestination, labelMap) }))
}

export const getFlowsByCompany = async (companyId: string) => {
    const cached = await FlowsCache.getByCompany(companyId)
    if (cached) return cached

    await getCompanyById(companyId)

    const [rows, edges] = await Promise.all([
        prisma.flow.findMany({ where: { companyId }, select }),
        FlowEdgeRepository.getBySource(companyId, 'flow'),
    ])
    const usedByMap = await resolveUsedByLabels('flow', rows.map((f) => f.id), companyId)
    const flows = await withDestinationLabels(
        rows.map((f) => toDto({ ...f, entryDestination: edges.get(f.id)?.entry ?? null, usedBy: usedByMap.get(f.id) ?? [] })),
        companyId,
    )
    await FlowsCache.setByCompany(companyId, flows)
    return flows
}

export const getFlowById = async (id: string) => {
    const cached = await FlowsCache.getFlow(id)
    if (cached) return cached

    const flow = await prisma.flow.findUnique({ where: { id }, select })
    if (!flow) throw new AppError('Flow not found', 404)

    const [entryDestination, usedByMap] = await Promise.all([
        FlowEdgeRepository.getOne('flow', id, 'entry'),
        resolveUsedByLabels('flow', [id], flow.companyId),
    ])
    const dto = (await withDestinationLabels([toDto({ ...flow, entryDestination, usedBy: usedByMap.get(id) ?? [] })], flow.companyId))[0]!
    await FlowsCache.setFlow(id, dto)
    return dto
}

export const createFlow = async (data: CreateFlowInput) => {
    await getCompanyById(data.companyId)

    const existing = await prisma.flow.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Flow already exists for this company', 409)

    await validateRouteDestination(data.entryDestination ?? null, data.companyId, 'entryDestination')

    const flow = await prisma.$transaction(async (tx) => {
        const created = await tx.flow.create({
            data: {
                name: data.name,
                companyId: data.companyId,
                layout: data.layout ?? [],
            },
            select,
        })
        await FlowEdgeRepository.setSlot(tx, data.companyId, 'flow', created.id, 'entry', data.entryDestination ?? null)
        return created
    })

    try {
        await FlowRepository.regenerate(data.companyId)
    } finally {
        await FlowsCache.invalidateByCompany(data.companyId)
    }
    return toDto({ ...flow, entryDestination: data.entryDestination ?? null, usedBy: [] })
}

export const updateFlow = async (id: string, data: UpdateFlowInput) => {
    const existing = await prisma.flow.findUnique({ where: { id } })
    if (!existing) throw new AppError('Flow not found', 404)

    if (data.name !== undefined && data.name !== existing.name) {
        const conflict = await prisma.flow.findUnique({
            where: { name_companyId: { name: data.name, companyId: existing.companyId } },
        })
        if (conflict) throw new AppError('Flow already exists for this company', 409)
    }

    if (data.entryDestination !== undefined) await validateRouteDestination(data.entryDestination, existing.companyId, 'entryDestination')

    const flow = await prisma.$transaction(async (tx) => {
        const updated = await tx.flow.update({
            where: { id },
            data: {
                name: data.name,
                layout: data.layout,
            },
            select,
        })
        if (data.entryDestination !== undefined) {
            await FlowEdgeRepository.setSlot(tx, existing.companyId, 'flow', id, 'entry', data.entryDestination)
        }
        return updated
    })

    try {
        await FlowRepository.regenerate(existing.companyId)
    } finally {
        await FlowsCache.invalidateFlow(id)
        await FlowsCache.invalidateByCompany(existing.companyId)
    }
    const [entryDestination, usedByMap] = await Promise.all([
        data.entryDestination !== undefined ? data.entryDestination : FlowEdgeRepository.getOne('flow', id, 'entry'),
        resolveUsedByLabels('flow', [id], existing.companyId),
    ])
    return toDto({ ...flow, entryDestination, usedBy: usedByMap.get(id) ?? [] })
}

// Autosave de posição no canvas — não toca em entryDestination/nome, não precisa regenerar
// dialplan (layout é só visual, não afeta nenhuma linha do .conf gerado).
export const updateFlowLayout = async (id: string, data: UpdateFlowLayoutInput) => {
    const existing = await prisma.flow.findUnique({ where: { id }, select: { companyId: true } })
    if (!existing) throw new AppError('Flow not found', 404)

    await prisma.flow.update({ where: { id }, data: { layout: data.layout } })

    await FlowsCache.invalidateFlow(id)
    await FlowsCache.invalidateByCompany(existing.companyId)
}

export const deleteFlow = async (id: string) => {
    const existing = await prisma.flow.findUnique({ where: { id }, select: { companyId: true } })
    if (!existing) throw new AppError('Flow not found', 404)

    await assertNotReferenced('flow', id)

    await prisma.$transaction(async (tx) => {
        await tx.flow.delete({ where: { id } })
        await FlowEdgeRepository.deleteAllForSource(tx, 'flow', id)
    })

    try {
        await FlowRepository.regenerate(existing.companyId)
    } finally {
        await FlowsCache.invalidateFlow(id)
        await FlowsCache.invalidateByCompany(existing.companyId)
    }
}

// ─── Grafo (GET /flows/:id/graph) ──────────────────────────────────────────────
// Percorre a partir do entryDestination seguindo os destinos de saída de cada nó visitado (BFS,
// com guard de ciclo) — devolve todos os nós alcançáveis + as arestas entre eles, pro canvas
// desenhar o grafo inteiro do Flow, não só o nó de entrada.

async function resolveNodeName(type: string, id: string): Promise<string | null> {
    switch (type) {
        case 'extension': {
            const e = await prisma.extension.findUnique({ where: { id }, select: { alias: true, name: true } })
            return e ? `${e.alias} - ${e.name}` : null
        }
        case 'queue': {
            const q = await prisma.queue.findUnique({ where: { id }, select: { name: true, number: true } })
            return q ? `${q.name} (${q.number})` : null
        }
        case 'voicemail':
            return id
        case 'timecondition': {
            const t = await prisma.timeCondition.findUnique({ where: { id }, select: { name: true } })
            return t?.name ?? null
        }
        case 'holiday': {
            const h = await prisma.holidayGroup.findUnique({ where: { id }, select: { name: true } })
            return h?.name ?? null
        }
        case 'announcement': {
            const a = await prisma.announcement.findUnique({ where: { id }, select: { name: true } })
            return a?.name ?? null
        }
        case 'ivr': {
            const i = await prisma.ivrMenu.findUnique({ where: { id }, select: { name: true } })
            return i?.name ?? null
        }
        case 'request': {
            const r = await prisma.requestTemplate.findUnique({ where: { id }, select: { name: true } })
            return r?.name ?? null
        }
        case 'variable-set': {
            const v = await prisma.variableSet.findUnique({ where: { id }, select: { name: true } })
            return v?.name ?? null
        }
        case 'variable-condition': {
            const v = await prisma.variableCondition.findUnique({ where: { id }, select: { name: true } })
            return v?.name ?? null
        }
        case 'flow': {
            const f = await prisma.flow.findUnique({ where: { id }, select: { name: true } })
            return f?.name ?? null
        }
        default:
            return null
    }
}

type OutgoingEdge = { slot: string; dest: RouteDestination }

// sourceType usado em FlowEdge difere do targetType (RouteDestination) pra holiday/ivr/request/
// variable-set/variable-condition — ver flow-edge.repository.ts::FlowSourceType.
async function resolveOutgoingEdges(type: string, id: string): Promise<OutgoingEdge[]> {
    const one = (sourceType: FlowSourceType, slot: string) =>
        FlowEdgeRepository.getOne(sourceType, id, slot).then((dest) => ({ slot, dest }))

    switch (type) {
        case 'queue':
            return [await one('queue', 'default')]
        case 'timecondition':
            return Promise.all([one('timecondition', 'true'), one('timecondition', 'false')])
        case 'holiday':
            return Promise.all([one('holidaygroup', 'true'), one('holidaygroup', 'false')])
        case 'announcement':
            return [await one('announcement', 'default')]
        case 'ivr': {
            const menu = await prisma.ivrMenu.findUnique({ where: { id }, select: { options: { select: { id: true, digit: true } } } })
            const edges = await Promise.all([one('ivrmenu', 'invalid'), one('ivrmenu', 'timeout'), one('ivrmenu', 'long')])
            if (!menu) return edges
            const optionEdges = await Promise.all(
                menu.options.map((o) => FlowEdgeRepository.getOne('ivroption', o.id, 'default').then((dest) => ({ slot: `digit:${o.digit}`, dest }))),
            )
            return [...edges, ...optionEdges]
        }
        case 'request':
            return Promise.all([one('requesttemplate', 'success'), one('requesttemplate', 'error')])
        case 'variable-set':
            return [await one('variableset', 'default')]
        case 'variable-condition':
            return Promise.all([one('variablecondition', 'true'), one('variablecondition', 'false')])
        case 'flow':
            return [await one('flow', 'entry')]
        default:
            // extension, voicemail, hangup: sem destino próprio, nó terminal
            return []
    }
}

type GraphNode = { type: string; id: string; name: string }
type GraphEdge = { from: { type: string; id: string; slot: string }; to: { type: string; id: string } }

export const getFlowGraph = async (id: string) => {
    const flow = await prisma.flow.findUnique({ where: { id }, select: { id: true } })
    if (!flow) throw new AppError('Flow not found', 404)

    const entry = await FlowEdgeRepository.getOne('flow', id, 'entry')
    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []
    if (!entry || entry.type === 'hangup' || !('id' in entry)) return { nodes, edges }

    const visited = new Set<string>()
    const queue: RouteDestination[] = [entry]

    while (queue.length > 0) {
        const current = queue.shift()
        if (!current || current.type === 'hangup' || !('id' in current)) continue

        const key = `${current.type}:${current.id}`
        if (visited.has(key)) continue
        visited.add(key)

        const name = await resolveNodeName(current.type, current.id)
        if (name === null) continue // registro sumiu (deletado) — não lista nó órfão

        nodes.push({ type: current.type, id: current.id, name })

        const outs = await resolveOutgoingEdges(current.type, current.id)
        for (const out of outs) {
            if (!out.dest || out.dest.type === 'hangup' || !('id' in out.dest)) continue
            edges.push({ from: { type: current.type, id: current.id, slot: out.slot }, to: { type: out.dest.type, id: out.dest.id } })
            queue.push(out.dest)
        }
    }

    return { nodes, edges }
}
