import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { DidsCache } from './cache/dids.cache'
import type { CreateDidInput, UpdateDidInput } from './schemas/did.schema'
import { InboundRouteRepository } from '../../asterisk/inboundroute.repository'
import { FlowEdgeRepository } from '../../asterisk/flow-edge.repository'
import type { InboundDest } from '../inbound-routes/schemas/inbound-route.schema'
import { InboundRoutesCache } from '../inbound-routes/cache/inbound-routes.cache'
import { resolveDestinationLabels, withDestinationLabel } from '../../schemas/route-destination-label'
import type { RouteDestination } from '../../schemas/route-destination.schema'
import { AppError } from '../../utils/errors/app.error'

const select = {
    id: true,
    number: true,
    companyId: true,
    status: true,
    notes: true,
    createdAt: true,
    updatedAt: true,
}

type DidRow = { id: string; companyId: string; [key: string]: unknown }

// "Usado por" de um DID nunca passa pelo FlowEdgeRepository (não é um tipo de route destination -
// é o próprio ponto de entrada da chamada) - é sempre resolvido pela FK direta InboundRoute.didId.
// Calculado fresco a cada leitura (não faz parte do que DidsCache guarda) porque depende de
// InboundRoute, uma entidade que muda independente do DID em si - mesmo motivo de usedBy em
// flows.service.ts/holiday-groups.service.ts não ser cacheado junto com a linha principal.
async function withUsedBy<T extends DidRow>(dids: T[]): Promise<(T & { usedBy: unknown[] })[]> {
    if (dids.length === 0) return []
    const didIds = dids.map((d) => d.id)
    const routes = await prisma.inboundRoute.findMany({
        where: { didId: { in: didIds } },
        select: { id: true, name: true, didId: true, companyId: true },
    })
    if (routes.length === 0) return dids.map((d) => ({ ...d, usedBy: [] }))

    const edges = await FlowEdgeRepository.getBySourceIds('inboundroute', routes.map((r) => r.id))

    const destsByCompany = new Map<string, RouteDestination[]>()
    for (const r of routes) {
        const arr = destsByCompany.get(r.companyId) ?? []
        arr.push(edges.get(r.id)?.default ?? null)
        destsByCompany.set(r.companyId, arr)
    }
    const labelMaps = new Map(
        await Promise.all([...destsByCompany.entries()].map(async ([companyId, dests]) => [companyId, await resolveDestinationLabels(dests, companyId)] as const)),
    )

    const routesByDid = new Map<string, unknown[]>()
    for (const r of routes) {
        const destination = withDestinationLabel(edges.get(r.id)?.default ?? null, labelMaps.get(r.companyId)!)
        const list = routesByDid.get(r.didId) ?? []
        list.push({ inboundRouteId: r.id, name: r.name, destination })
        routesByDid.set(r.didId, list)
    }

    return dids.map((d) => ({ ...d, usedBy: routesByDid.get(d.id) ?? [] }))
}

export const getAllDids = async (companyIds?: string[], userId?: string) => {
    if (companyIds && companyIds.length === 0) return []

    let dids: DidRow[] | null = null
    if (!companyIds) dids = (await DidsCache.getAll()) as DidRow[] | null
    else if (userId) dids = (await DidsCache.getForScope(userId)) as DidRow[] | null

    if (!dids) {
        dids = await prisma.did.findMany({
            where: companyIds ? { companyId: { in: companyIds } } : undefined,
            select,
        })
        if (!companyIds) await DidsCache.setAll(dids)
        else if (userId) await DidsCache.setForScope(userId, dids)
    }
    return withUsedBy(dids)
}

export const getDidsByCompany = async (companyId: string) => {
    let dids = (await DidsCache.getDidsByCompany(companyId)) as DidRow[] | null
    if (!dids) {
        await getCompanyById(companyId)
        dids = await prisma.did.findMany({ where: { companyId }, select })
        await DidsCache.setDidsByCompany(companyId, dids)
    }
    return withUsedBy(dids)
}

export const getDidById = async (id: string) => {
    let did = (await DidsCache.getDid(id)) as DidRow | null
    if (!did) {
        did = await prisma.did.findUnique({ where: { id }, select })
        if (!did) throw new AppError('DID not found', 404)
        await DidsCache.setDid(id, did)
    }
    return (await withUsedBy([did]))[0]!
}

export const createDid = async (data: CreateDidInput) => {
    await getCompanyById(data.companyId)

    // Número é único GLOBALMENTE, não só por empresa - senão o roteamento de entrada (chave
    // <did>_<companyAsteriskId>, ver inboundroute.repository.ts) fica ambíguo quando a operadora
    // entrega a chamada por um tronco de empresa diferente da dona do DID (só o lookup rápido por
    // accountcode do tronco de entrada não bastaria pra desambiguar - ver resolve-did-route em
    // agi-server.ts)
    const existing = await prisma.did.findUnique({ where: { number: data.number } })
    if (existing) throw new AppError('DID already exists', 409)

    const did = await prisma.did.create({ data, select })

    await DidsCache.invalidateDidsByCompany(data.companyId)
    await DidsCache.invalidateNamespace()
    return did
}

export const updateDid = async (id: string, data: UpdateDidInput) => {
    const existing = await prisma.did.findUnique({ where: { id } })
    if (!existing) throw new AppError('DID not found', 404)

    const isReassign = data.companyId != null && data.companyId !== existing.companyId
    const targetCompanyId = data.companyId ?? existing.companyId

    const oldCompany = await getCompanyById(existing.companyId)
    if (isReassign) await getCompanyById(data.companyId!)

    // Conflito só é possível trocando o número em si - reatribuir de empresa (isReassign) não muda
    // o number, e a unicidade agora é global (não por companyId), então não depende de targetCompanyId
    if (data.number && data.number !== existing.number) {
        const conflict = await prisma.did.findUnique({ where: { number: data.number } })
        if (conflict && conflict.id !== id) throw new AppError('DID already exists', 409)
    }

    if (isReassign) {
        const inboundRoutes = await prisma.inboundRoute.findMany({
            where: { didId: id },
            select: { id: true, trunkId: true },
        })

        const did = await prisma.$transaction(async (tx) => {
            for (const ir of inboundRoutes) {
                await InboundRouteRepository.delete(tx, oldCompany.asteriskId, existing.number)
            }
            if (inboundRoutes.length > 0) {
                await tx.inboundRoute.deleteMany({ where: { didId: id } })
                await FlowEdgeRepository.deleteAllForSources(tx, 'inboundroute', inboundRoutes.map((ir) => ir.id))
            }
            return tx.did.update({ where: { id }, data, select })
        })

        for (const ir of inboundRoutes) {
            await InboundRoutesCache.invalidateRoute(ir.id)
        }
        if (inboundRoutes.length > 0) {
            await InboundRoutesCache.invalidateByCompany(existing.companyId)
            await InboundRoutesCache.invalidateNamespace()
        }
        await DidsCache.invalidateDid(id)
        await DidsCache.invalidateDidsByCompany(existing.companyId)
        await DidsCache.invalidateDidsByCompany(targetCompanyId)
        await DidsCache.invalidateNamespace()
        return did
    }

    const oldRoutingKey = existing.number
    const newNumber = data.number ?? existing.number
    const newRoutingKey = newNumber

    const inboundRoutes = newRoutingKey !== oldRoutingKey
        ? await prisma.inboundRoute.findMany({
            where: { didId: id },
            select: { id: true, trunkId: true, trunk: { select: { maxInChannels: true } } },
        })
        : []

    const destinations = await FlowEdgeRepository.getBySourceIds('inboundroute', inboundRoutes.map((ir) => ir.id))

    const did = await prisma.$transaction(async (tx) => {
        const updated = await tx.did.update({ where: { id }, data, select })
        for (const ir of inboundRoutes) {
            const dest = destinations.get(ir.id)?.default ?? null
            await InboundRouteRepository.delete(tx, oldCompany.asteriskId, oldRoutingKey)
            await InboundRouteRepository.create(tx, ir.trunkId, oldCompany.asteriskId, newRoutingKey, dest, ir.trunk.maxInChannels)
        }
        return updated
    })

    for (const ir of inboundRoutes) {
        await InboundRoutesCache.invalidateRoute(ir.id)
    }
    if (inboundRoutes.length > 0) await InboundRoutesCache.invalidateByCompany(existing.companyId)
    await DidsCache.invalidateDid(id)
    await DidsCache.invalidateDidsByCompany(existing.companyId)
    await DidsCache.invalidateNamespace()
    return did
}

export const deleteDid = async (id: string) => {
    const existing = await prisma.did.findUnique({ where: { id } })
    if (!existing) throw new AppError('DID not found', 404)

    const company = await getCompanyById(existing.companyId)
    const inboundRoutes = await prisma.inboundRoute.findMany({
        where: { didId: id },
        select: { id: true },
    })

    const routingKey = existing.number

    await prisma.$transaction(async (tx) => {
        if (inboundRoutes.length > 0) await InboundRouteRepository.delete(tx, company.asteriskId, routingKey)
        await tx.did.delete({ where: { id } })
    })

    for (const ir of inboundRoutes) {
        await InboundRoutesCache.invalidateRoute(ir.id)
    }
    await InboundRoutesCache.invalidateByCompany(existing.companyId)
    await DidsCache.invalidateDid(id)
    await DidsCache.invalidateDidsByCompany(existing.companyId)
    await DidsCache.invalidateNamespace()
}
