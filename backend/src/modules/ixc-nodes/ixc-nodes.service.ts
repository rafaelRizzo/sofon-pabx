import { Prisma } from '../../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import { decryptForCompany } from '../../lib/crypto'
import { getCompanyById } from '../companies/companies.service'
import { IxcNodesCache } from './cache/ixc-nodes.cache'
import { IxcNodeRepository } from '../../asterisk/destinations/ixc-node.repository'
import { FlowEdgeRepository } from '../../asterisk/flows/flow-edge.repository'
import { syncFlowNodeLabel } from '../flows/flow-nodes.service'
import { validateRouteDestination, assertNotReferenced } from '../../schemas/route-destination.validate'
import { resolveDestinationLabels, withDestinationLabel } from '../../schemas/route-destination-label'
import { resolveUsedByLabels, type UsedByRef } from '../../schemas/flow-reference-label'
import type { RouteDestination } from '../../schemas/route-destination.schema'
import type { CreateIxcNodeInput, UpdateIxcNodeInput, TestIxcNodeInput } from './schemas/ixc-node.schema'
import { runIxcAction, type IxcAction } from '../../integrations/ixc/client'
import { AppError } from '../../utils/errors/app.error'

const select = {
    id: true,
    name: true,
    companyId: true,
    credentialId: true,
    action: true,
    params: true,
    timeoutMs: true,
    variableMappings: true,
    createdAt: true,
    updatedAt: true,
} as const

const _byId = () => prisma.ixcNode.findUnique({ where: { id: '' }, select })
export type IxcNodeDto = NonNullable<Awaited<ReturnType<typeof _byId>>> & { onSuccess: RouteDestination; onError: RouteDestination; usedBy: UsedByRef[] }
type IxcNodeRow = NonNullable<Awaited<ReturnType<typeof _byId>>> & { onSuccess: RouteDestination; onError: RouteDestination }

const validateDest = (dest: RouteDestination | undefined | null, companyId: string, label: string) =>
    validateRouteDestination(dest ?? null, companyId, label)

async function assertCredentialBelongsToCompany(credentialId: string, companyId: string) {
    const credential = await prisma.integrationCredential.findUnique({ where: { id: credentialId }, select: { companyId: true, provider: true } })
    if (!credential) throw new AppError('Integration credential not found', 404)
    if (credential.companyId !== companyId) throw new AppError('Integration credential belongs to different company', 403)
    if (credential.provider !== 'ixc') throw new AppError('Credential is not an IXCsoft credential', 400)
}

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
        [...byCompany.entries()].map(([companyId, ids]) => resolveUsedByLabels('ixc', ids, companyId)),
    )
    const merged = new Map<string, UsedByRef[]>()
    for (const map of usedByMaps) for (const [id, refs] of map) merged.set(id, refs)
    return nodes.map((n) => ({ ...n, usedBy: merged.get(n.id) ?? [] }))
}

export const getAllIxcNodes = async (companyIds?: string[]) => {
    if (companyIds && companyIds.length === 0) return []

    let rows = !companyIds ? ((await IxcNodesCache.getAll()) as IxcNodeRow[] | null) : null
    if (!rows) {
        const nodeRows = await prisma.ixcNode.findMany({
            where: companyIds ? { companyId: { in: companyIds } } : undefined,
            select,
        })
        const edges = await FlowEdgeRepository.getBySourceIds('ixcnode', nodeRows.map((n) => n.id))
        rows = nodeRows.map((n) => ({ ...n, onSuccess: edges.get(n.id)?.success ?? null, onError: edges.get(n.id)?.error ?? null }))
        if (!companyIds) await IxcNodesCache.setAll(rows)
    }

    return withUsedBy(await withDestinationLabels(rows))
}

export const getIxcNodesByCompany = async (companyId: string) => {
    let rows = (await IxcNodesCache.getByCompany(companyId)) as IxcNodeRow[] | null
    if (!rows) {
        await getCompanyById(companyId)

        const [nodeRows, edges] = await Promise.all([
            prisma.ixcNode.findMany({ where: { companyId }, select }),
            FlowEdgeRepository.getBySource(companyId, 'ixcnode'),
        ])
        rows = nodeRows.map((n) => ({ ...n, onSuccess: edges.get(n.id)?.success ?? null, onError: edges.get(n.id)?.error ?? null }))
        await IxcNodesCache.setByCompany(companyId, rows)
    }

    const usedByMap = await resolveUsedByLabels('ixc', rows.map((n) => n.id), companyId)
    return withDestinationLabels(rows.map((n) => ({ ...n, usedBy: usedByMap.get(n.id) ?? [] })))
}

export const getIxcNodeById = async (id: string) => {
    let row = (await IxcNodesCache.getNode(id)) as IxcNodeRow | null
    if (!row) {
        const found = await prisma.ixcNode.findUnique({ where: { id }, select })
        if (!found) throw new AppError('IXC node not found', 404)

        const [onSuccess, onError] = await Promise.all([
            FlowEdgeRepository.getOne('ixcnode', id, 'success'),
            FlowEdgeRepository.getOne('ixcnode', id, 'error'),
        ])
        row = { ...found, onSuccess, onError }
        await IxcNodesCache.setNode(id, row)
    }

    const usedByMap = await resolveUsedByLabels('ixc', [id], row.companyId)
    return (await withDestinationLabels([{ ...row, usedBy: usedByMap.get(id) ?? [] }]))[0]!
}

export const createIxcNode = async (data: CreateIxcNodeInput) => {
    await getCompanyById(data.companyId)
    await assertCredentialBelongsToCompany(data.credentialId, data.companyId)

    const existing = await prisma.ixcNode.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('IXC node already exists for this company', 409)

    await validateDest(data.onSuccess, data.companyId, 'onSuccess')
    await validateDest(data.onError, data.companyId, 'onError')

    const node = await prisma.$transaction(async (tx) => {
        const created = await tx.ixcNode.create({
            data: {
                name: data.name,
                companyId: data.companyId,
                credentialId: data.credentialId,
                action: data.action,
                params: (data.params as Prisma.InputJsonValue) ?? undefined,
                timeoutMs: data.timeoutMs,
                variableMappings: data.variableMappings,
            },
            select,
        })
        await Promise.all([
            FlowEdgeRepository.setSlot(tx, data.companyId, 'ixcnode', created.id, 'success', data.onSuccess ?? null),
            FlowEdgeRepository.setSlot(tx, data.companyId, 'ixcnode', created.id, 'error', data.onError ?? null),
        ])
        return created
    })

    try {
        await IxcNodeRepository.regenerate(data.companyId)
    } finally {
        await IxcNodesCache.invalidateByCompany(data.companyId)
        await IxcNodesCache.invalidateAll()
    }
    return { ...node, onSuccess: data.onSuccess ?? null, onError: data.onError ?? null, usedBy: [] }
}

export const updateIxcNode = async (id: string, data: UpdateIxcNodeInput) => {
    const existing = await prisma.ixcNode.findUnique({ where: { id } })
    if (!existing) throw new AppError('IXC node not found', 404)

    if (data.name && data.name !== existing.name) {
        const conflict = await prisma.ixcNode.findUnique({
            where: { name_companyId: { name: data.name, companyId: existing.companyId } },
        })
        if (conflict) throw new AppError('IXC node already exists for this company', 409)
    }

    if (data.credentialId) await assertCredentialBelongsToCompany(data.credentialId, existing.companyId)
    if (data.onSuccess !== undefined) await validateDest(data.onSuccess, existing.companyId, 'onSuccess')
    if (data.onError !== undefined) await validateDest(data.onError, existing.companyId, 'onError')

    const node = await prisma.$transaction(async (tx) => {
        const updated = await tx.ixcNode.update({
            where: { id },
            data: {
                name: data.name,
                credentialId: data.credentialId,
                action: data.action,
                params: data.params as Prisma.InputJsonValue | undefined,
                timeoutMs: data.timeoutMs,
                variableMappings: data.variableMappings,
            },
            select,
        })
        await Promise.all([
            data.onSuccess !== undefined ? FlowEdgeRepository.setSlot(tx, existing.companyId, 'ixcnode', id, 'success', data.onSuccess) : null,
            data.onError !== undefined ? FlowEdgeRepository.setSlot(tx, existing.companyId, 'ixcnode', id, 'error', data.onError) : null,
        ])
        return updated
    })

    if (data.name && data.name !== existing.name) await syncFlowNodeLabel('ixc', id, data.name)

    try {
        await IxcNodeRepository.regenerate(existing.companyId)
    } finally {
        await IxcNodesCache.invalidateNode(id)
        await IxcNodesCache.invalidateByCompany(existing.companyId)
        await IxcNodesCache.invalidateAll()
    }

    const [onSuccess, onError, usedByMap] = await Promise.all([
        data.onSuccess !== undefined ? data.onSuccess : FlowEdgeRepository.getOne('ixcnode', id, 'success'),
        data.onError !== undefined ? data.onError : FlowEdgeRepository.getOne('ixcnode', id, 'error'),
        resolveUsedByLabels('ixc', [id], existing.companyId),
    ])
    return { ...node, onSuccess, onError, usedBy: usedByMap.get(id) ?? [] }
}

export const testIxcNode = async (data: TestIxcNodeInput) => {
    await getCompanyById(data.companyId)
    await assertCredentialBelongsToCompany(data.credentialId, data.companyId)

    const credential = await prisma.integrationCredential.findUnique({ where: { id: data.credentialId } })
    if (!credential) throw new AppError('Integration credential not found', 404)

    const token = decryptForCompany(data.companyId, {
        ciphertext: credential.tokenCiphertext,
        iv: credential.tokenIv,
        tag: credential.tokenTag,
    })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), data.timeoutMs)
    try {
        const result = await runIxcAction(
            { baseUrl: credential.baseUrl, token },
            data.action as IxcAction,
            data.params ?? {},
            controller.signal,
        )
        return {
            url: result.url,
            payload: result.payload,
            status: result.status,
            ok: result.ok,
            data: result.data,
            rawBody: result.rawBody.slice(0, 5000),
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new AppError(`Falha ao conectar ao IXCsoft: ${message}`, 502)
    } finally {
        clearTimeout(timeout)
    }
}

export const deleteIxcNode = async (id: string) => {
    const existing = await prisma.ixcNode.findUnique({ where: { id } })
    if (!existing) throw new AppError('IXC node not found', 404)

    await assertNotReferenced('ixc', id)

    await prisma.$transaction(async (tx) => {
        await tx.ixcNode.delete({ where: { id } })
        await FlowEdgeRepository.deleteAllForSource(tx, 'ixcnode', id)
    })

    try {
        await IxcNodeRepository.regenerate(existing.companyId)
    } finally {
        await IxcNodesCache.invalidateNode(id)
        await IxcNodesCache.invalidateByCompany(existing.companyId)
        await IxcNodesCache.invalidateAll()
    }
}
