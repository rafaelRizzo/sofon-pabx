import { Prisma } from '../../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { RequestTemplatesCache } from './cache/request-templates.cache'
import { RequestTemplateRepository } from '../../asterisk/request-template.repository'
import { FlowEdgeRepository } from '../../asterisk/flow-edge.repository'
import { validateRouteDestination, assertNotReferenced } from '../../schemas/route-destination.validate'
import { resolveDestinationLabels, withDestinationLabel } from '../../schemas/route-destination-label'
import { resolveUsedByLabels, type UsedByRef } from '../../schemas/flow-reference-label'
import type { RouteDestination } from '../../schemas/route-destination.schema'
import type { CreateRequestTemplateInput, UpdateRequestTemplateInput } from './schemas/request-template.schema'
import { AppError } from '../../utils/errors/app.error'

const select = {
    id: true,
    name: true,
    companyId: true,
    method: true,
    url: true,
    headers: true,
    body: true,
    timeoutMs: true,
    variableMappings: true,
    createdAt: true,
    updatedAt: true,
} as const

const _byId = () => prisma.requestTemplate.findUnique({ where: { id: '' }, select })
export type RequestTemplateDto = NonNullable<Awaited<ReturnType<typeof _byId>>> & { onSuccess: RouteDestination; onError: RouteDestination; usedBy: UsedByRef[] }

const validateDest = (dest: RouteDestination | undefined | null, companyId: string, label: string) =>
    validateRouteDestination(dest ?? null, companyId, label)

// Anexa o nome legível de onSuccess/onError (resolvido no backend, cache-first — ver
// route-destination-label.ts). Agrupa por companyId — getAllRequestTemplates pode misturar
// empresas diferentes na mesma lista (visão admin).
async function withDestinationLabels<T extends { onSuccess: unknown; onError: unknown; companyId: string }>(templates: T[]): Promise<T[]> {
    if (templates.length === 0) return templates
    const byCompany = new Map<string, RouteDestination[]>()
    for (const t of templates) {
        const arr = byCompany.get(t.companyId) ?? []
        arr.push(t.onSuccess as RouteDestination, t.onError as RouteDestination)
        byCompany.set(t.companyId, arr)
    }
    const labelMaps = new Map(
        await Promise.all([...byCompany.entries()].map(async ([companyId, dests]) => [companyId, await resolveDestinationLabels(dests, companyId)] as const)),
    )
    return templates.map((t) => {
        const labelMap = labelMaps.get(t.companyId)!
        return {
            ...t,
            onSuccess: withDestinationLabel(t.onSuccess as RouteDestination, labelMap),
            onError: withDestinationLabel(t.onError as RouteDestination, labelMap),
        }
    })
}

// Anexa "usado por" agrupando por companyId — getAllRequestTemplates pode misturar empresas
// diferentes na mesma lista (visão admin), e resolveUsedByLabels resolve só 1 empresa por vez.
async function withUsedBy<T extends { id: string; companyId: string }>(templates: T[]): Promise<(T & { usedBy: UsedByRef[] })[]> {
    if (templates.length === 0) return []
    const byCompany = new Map<string, string[]>()
    for (const t of templates) {
        const ids = byCompany.get(t.companyId) ?? []
        ids.push(t.id)
        byCompany.set(t.companyId, ids)
    }
    const usedByMaps = await Promise.all(
        [...byCompany.entries()].map(([companyId, ids]) => resolveUsedByLabels('request', ids, companyId)),
    )
    const merged = new Map<string, UsedByRef[]>()
    for (const map of usedByMaps) for (const [id, refs] of map) merged.set(id, refs)
    return templates.map((t) => ({ ...t, usedBy: merged.get(t.id) ?? [] }))
}

export const getAllRequestTemplates = async (companyIds?: string[]) => {
    if (companyIds && companyIds.length === 0) return []

    if (!companyIds) {
        const cached = await RequestTemplatesCache.getAll()
        if (cached) return cached
    }

    const rows = await prisma.requestTemplate.findMany({
        where: companyIds ? { companyId: { in: companyIds } } : undefined,
        select,
    })
    const edges = await FlowEdgeRepository.getBySourceIds('requesttemplate', rows.map((t) => t.id))
    const templates = await withUsedBy(await withDestinationLabels(rows.map((t) => ({
        ...t,
        onSuccess: edges.get(t.id)?.success ?? null,
        onError: edges.get(t.id)?.error ?? null,
    }))))

    if (!companyIds) await RequestTemplatesCache.setAll(templates)
    return templates
}

export const getRequestTemplatesByCompany = async (companyId: string) => {
    const cached = await RequestTemplatesCache.getByCompany(companyId)
    if (cached) return cached

    await getCompanyById(companyId)

    const [rows, edges] = await Promise.all([
        prisma.requestTemplate.findMany({ where: { companyId }, select }),
        FlowEdgeRepository.getBySource(companyId, 'requesttemplate'),
    ])
    const usedByMap = await resolveUsedByLabels('request', rows.map((t) => t.id), companyId)
    const templates = await withDestinationLabels(rows.map((t) => ({
        ...t,
        onSuccess: edges.get(t.id)?.success ?? null,
        onError: edges.get(t.id)?.error ?? null,
        usedBy: usedByMap.get(t.id) ?? [],
    })))
    await RequestTemplatesCache.setByCompany(companyId, templates)
    return templates
}

export const getRequestTemplateById = async (id: string) => {
    const cached = await RequestTemplatesCache.getTemplate(id)
    if (cached) return cached

    const found = await prisma.requestTemplate.findUnique({ where: { id }, select })
    if (!found) throw new AppError('Request template not found', 404)

    const [onSuccess, onError, usedByMap] = await Promise.all([
        FlowEdgeRepository.getOne('requesttemplate', id, 'success'),
        FlowEdgeRepository.getOne('requesttemplate', id, 'error'),
        resolveUsedByLabels('request', [id], found.companyId),
    ])
    const template = (await withDestinationLabels([{ ...found, onSuccess, onError, usedBy: usedByMap.get(id) ?? [] }]))[0]!
    await RequestTemplatesCache.setTemplate(id, template)
    return template
}

export const createRequestTemplate = async (data: CreateRequestTemplateInput) => {
    await getCompanyById(data.companyId)

    const existing = await prisma.requestTemplate.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Request template already exists for this company', 409)

    await validateDest(data.onSuccess, data.companyId, 'onSuccess')
    await validateDest(data.onError, data.companyId, 'onError')

    const template = await prisma.$transaction(async (tx) => {
        const created = await tx.requestTemplate.create({
            data: {
                name: data.name,
                companyId: data.companyId,
                method: data.method,
                url: data.url,
                headers: data.headers ?? undefined,
                body: (data.body as Prisma.InputJsonValue) ?? undefined,
                timeoutMs: data.timeoutMs,
                variableMappings: data.variableMappings,
            },
            select,
        })
        await Promise.all([
            FlowEdgeRepository.setSlot(tx, data.companyId, 'requesttemplate', created.id, 'success', data.onSuccess ?? null),
            FlowEdgeRepository.setSlot(tx, data.companyId, 'requesttemplate', created.id, 'error', data.onError ?? null),
        ])
        return created
    })

    try {
        await RequestTemplateRepository.regenerate(data.companyId)
    } finally {
        await RequestTemplatesCache.invalidateByCompany(data.companyId)
        await RequestTemplatesCache.invalidateAll()
    }
    return { ...template, onSuccess: data.onSuccess ?? null, onError: data.onError ?? null, usedBy: [] }
}

export const updateRequestTemplate = async (id: string, data: UpdateRequestTemplateInput) => {
    const existing = await prisma.requestTemplate.findUnique({ where: { id } })
    if (!existing) throw new AppError('Request template not found', 404)

    if (data.name && data.name !== existing.name) {
        const conflict = await prisma.requestTemplate.findUnique({
            where: { name_companyId: { name: data.name, companyId: existing.companyId } },
        })
        if (conflict) throw new AppError('Request template already exists for this company', 409)
    }

    if (data.onSuccess !== undefined) await validateDest(data.onSuccess, existing.companyId, 'onSuccess')
    if (data.onError !== undefined) await validateDest(data.onError, existing.companyId, 'onError')

    const template = await prisma.$transaction(async (tx) => {
        const updated = await tx.requestTemplate.update({
            where: { id },
            data: {
                name: data.name,
                method: data.method,
                url: data.url,
                headers: data.headers === undefined ? undefined : (data.headers ?? Prisma.JsonNull),
                body: data.body === undefined ? undefined : ((data.body as Prisma.InputJsonValue) ?? Prisma.JsonNull),
                timeoutMs: data.timeoutMs,
                variableMappings: data.variableMappings,
            },
            select,
        })
        await Promise.all([
            data.onSuccess !== undefined ? FlowEdgeRepository.setSlot(tx, existing.companyId, 'requesttemplate', id, 'success', data.onSuccess) : null,
            data.onError !== undefined ? FlowEdgeRepository.setSlot(tx, existing.companyId, 'requesttemplate', id, 'error', data.onError) : null,
        ])
        return updated
    })

    await RequestTemplatesCache.invalidateTemplate(id)
    await RequestTemplatesCache.invalidateByCompany(existing.companyId)
    await RequestTemplatesCache.invalidateAll()

    const [onSuccess, onError, usedByMap] = await Promise.all([
        data.onSuccess !== undefined ? data.onSuccess : FlowEdgeRepository.getOne('requesttemplate', id, 'success'),
        data.onError !== undefined ? data.onError : FlowEdgeRepository.getOne('requesttemplate', id, 'error'),
        resolveUsedByLabels('request', [id], existing.companyId),
    ])
    return { ...template, onSuccess, onError, usedBy: usedByMap.get(id) ?? [] }
}

export const deleteRequestTemplate = async (id: string) => {
    const existing = await prisma.requestTemplate.findUnique({ where: { id } })
    if (!existing) throw new AppError('Request template not found', 404)

    await assertNotReferenced('request', id)

    await prisma.$transaction(async (tx) => {
        await tx.requestTemplate.delete({ where: { id } })
        await FlowEdgeRepository.deleteAllForSource(tx, 'requesttemplate', id)
    })

    try {
        await RequestTemplateRepository.regenerate(existing.companyId)
    } finally {
        await RequestTemplatesCache.invalidateTemplate(id)
        await RequestTemplatesCache.invalidateByCompany(existing.companyId)
        await RequestTemplatesCache.invalidateAll()
    }
}
