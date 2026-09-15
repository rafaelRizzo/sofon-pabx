import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { InboundRoutesCache } from './cache/inbound-routes.cache'
import { InboundRouteRepository } from '../../asterisk/inboundroute.repository'
import { resyncTrunkIdentify } from '../trunks/trunks.service'
import { FlowEdgeRepository } from '../../asterisk/flow-edge.repository'
import { validateRouteDestination } from '../../schemas/route-destination.validate'
import { resolveDestinationLabels, withDestinationLabel } from '../../schemas/route-destination-label'
import type { RouteDestination } from '../../schemas/route-destination.schema'
import type { CreateInboundRouteInput, UpdateInboundRouteInput, InboundDest } from './schemas/inbound-route.schema'
import { AppError } from '../../utils/errors/app.error'

const inboundRouteSelect = {
    id: true,
    name: true,
    companyId: true,
    didId: true,
    trunkId: true,
    did: { select: { id: true, number: true } },
    trunk: { select: { id: true, name: true } },
    notes: true,
    createdAt: true,
    updatedAt: true,
} as const

const _byId = () => prisma.inboundRoute.findUnique({ where: { id: '' }, select: inboundRouteSelect })
export type InboundRouteDto = NonNullable<Awaited<ReturnType<typeof _byId>>> & { destination: RouteDestination }
type InboundRouteRow = InboundRouteDto

const validateDestination = (dest: InboundDest | undefined | null, companyId: string) =>
    validateRouteDestination(dest ?? null, companyId)

// Anexa o nome legível de destination (resolvido no backend, cache-first - ver
// route-destination-label.ts). Agrupa por companyId - getAllInboundRoutes pode misturar
// empresas diferentes na mesma lista (visão admin).
async function withDestinationLabels<T extends { destination: unknown; companyId: string }>(routes: T[]): Promise<T[]> {
    if (routes.length === 0) return routes
    const byCompany = new Map<string, RouteDestination[]>()
    for (const r of routes) {
        const arr = byCompany.get(r.companyId) ?? []
        arr.push(r.destination as RouteDestination)
        byCompany.set(r.companyId, arr)
    }
    const labelMaps = new Map(
        await Promise.all([...byCompany.entries()].map(async ([companyId, dests]) => [companyId, await resolveDestinationLabels(dests, companyId)] as const)),
    )
    return routes.map((r) => ({ ...r, destination: withDestinationLabel(r.destination as RouteDestination, labelMaps.get(r.companyId)!) }))
}

export const getInboundRoutesByCompany = async (companyId: string) => {
    let rows = (await InboundRoutesCache.getByCompany(companyId)) as InboundRouteRow[] | null
    if (!rows) {
        await getCompanyById(companyId)

        const [irRows, edges] = await Promise.all([
            prisma.inboundRoute.findMany({ where: { companyId }, select: inboundRouteSelect }),
            FlowEdgeRepository.getBySource(companyId, 'inboundroute'),
        ])
        rows = irRows.map((r) => ({ ...r, destination: edges.get(r.id)?.default ?? null }))
        await InboundRoutesCache.setByCompany(companyId, rows)
    }

    return withDestinationLabels(rows)
}

export const getAllInboundRoutes = async (companyIds?: string[], userId?: string) => {
    if (companyIds && companyIds.length === 0) return []

    let rows: InboundRouteRow[] | null = null
    if (!companyIds) rows = (await InboundRoutesCache.getAll()) as InboundRouteRow[] | null
    else if (userId) rows = (await InboundRoutesCache.getForScope(userId)) as InboundRouteRow[] | null

    if (!rows) {
        const irRows = await prisma.inboundRoute.findMany({
            where: companyIds ? { companyId: { in: companyIds } } : undefined,
            select: inboundRouteSelect,
        })
        const edges = await FlowEdgeRepository.getBySourceIds('inboundroute', irRows.map((r) => r.id))
        rows = irRows.map((r) => ({ ...r, destination: edges.get(r.id)?.default ?? null }))
        if (!companyIds) await InboundRoutesCache.setAll(rows)
        else if (userId) await InboundRoutesCache.setForScope(userId, rows)
    }

    return withDestinationLabels(rows)
}

export const getInboundRouteById = async (id: string): Promise<InboundRouteDto> => {
    let row = (await InboundRoutesCache.getRoute(id)) as InboundRouteRow | null
    if (!row) {
        const found = await prisma.inboundRoute.findUnique({ where: { id }, select: inboundRouteSelect })
        if (!found) throw new AppError('Inbound route not found', 404)

        const destination = await FlowEdgeRepository.getOne('inboundroute', id, 'default')
        row = { ...found, destination }
        await InboundRoutesCache.setRoute(id, row)
    }

    return (await withDestinationLabels([row]))[0]!
}

export const createInboundRoute = async (data: CreateInboundRouteInput) => {
    const [company, did, trunk] = await Promise.all([
        getCompanyById(data.companyId),
        prisma.did.findUnique({ where: { id: data.didId }, select: { id: true, number: true, companyId: true } }),
        prisma.trunk.findUnique({
            where: { id: data.trunkId },
            select: { id: true, companyId: true, maxInChannels: true, registrationMode: true },
        }),
    ])

    if (!did) throw new AppError('DID not found', 404)
    if (!trunk) throw new AppError('Trunk not found', 404)
    if (did.companyId !== data.companyId) throw new AppError('DID belongs to different company', 403)
    if (trunk.companyId !== data.companyId) throw new AppError('Trunk belongs to different company', 403)
    if (trunk.registrationMode === 'custom')
        throw new AppError('Trunk custom não recebe chamadas, não pode ter Inbound Route', 400)

    // Chave de roteamento é <did>_<companyAsteriskId> (ver inboundroute.repository.ts), não
    // <did>_<trunkId> - um mesmo DID linkado a 2 trunks colidiria na mesma exten. Cenário sem uso
    // real (um DID físico só chega por 1 conexão de operadora por vez), bloqueado aqui: só 1
    // Inbound Route por DID, seja qual for o trunk.
    const existing = await prisma.inboundRoute.findFirst({ where: { didId: data.didId } })
    if (existing) throw new AppError('DID já tem Inbound Route cadastrada', 409)

    await validateDestination(data.destination ?? null, data.companyId)

    const route = await prisma.$transaction(async (tx) => {
        const created = await tx.inboundRoute.create({
            data: {
                name: data.name,
                companyId: data.companyId,
                didId: data.didId,
                trunkId: data.trunkId,
                notes: data.notes,
            },
            select: inboundRouteSelect,
        })

        await FlowEdgeRepository.setSlot(tx, data.companyId, 'inboundroute', created.id, 'default', data.destination ?? null)
        await InboundRouteRepository.create(tx, data.trunkId, company.asteriskId, did.number, data.destination ?? null, trunk.maxInChannels)
        return created
    })

    await InboundRoutesCache.invalidateByCompany(data.companyId)
    await InboundRoutesCache.invalidateNamespace()
    await resyncTrunkIdentify(data.trunkId)
    return { ...route, destination: data.destination ?? null }
}

export const updateInboundRoute = async (id: string, data: UpdateInboundRouteInput) => {
    const existing = await prisma.inboundRoute.findUnique({
        where: { id },
        include: {
            did: { select: { number: true } },
            trunk: { select: { maxInChannels: true } },
            company: { select: { asteriskId: true } },
        },
    })
    if (!existing) throw new AppError('Inbound route not found', 404)

    if (data.destination !== undefined) {
        await validateDestination(data.destination, existing.companyId)
    }

    const newDest: InboundDest = data.destination !== undefined ? data.destination : await FlowEdgeRepository.getOne('inboundroute', id, 'default')

    const route = await prisma.$transaction(async (tx) => {
        const updated = await tx.inboundRoute.update({
            where: { id },
            data: { name: data.name, notes: data.notes },
            select: inboundRouteSelect,
        })

        if (data.destination !== undefined) {
            await FlowEdgeRepository.setSlot(tx, existing.companyId, 'inboundroute', id, 'default', data.destination)
        }
        await InboundRouteRepository.update(tx, existing.trunkId, existing.company.asteriskId, existing.did.number, newDest, existing.trunk.maxInChannels)
        return updated
    })

    await InboundRoutesCache.invalidateRoute(id)
    await InboundRoutesCache.invalidateByCompany(existing.companyId)
    await InboundRoutesCache.invalidateNamespace()
    return { ...route, destination: newDest }
}

export const deleteInboundRoute = async (id: string) => {
    const existing = await prisma.inboundRoute.findUnique({
        where: { id },
        include: { did: { select: { number: true } }, company: { select: { asteriskId: true } } },
    })
    if (!existing) throw new AppError('Inbound route not found', 404)

    await prisma.$transaction(async (tx) => {
        await InboundRouteRepository.delete(tx, existing.company.asteriskId, existing.did.number)
        await tx.inboundRoute.delete({ where: { id } })
        await FlowEdgeRepository.deleteAllForSource(tx, 'inboundroute', id)
    })

    await InboundRoutesCache.invalidateRoute(id)
    await InboundRoutesCache.invalidateByCompany(existing.companyId)
    await InboundRoutesCache.invalidateNamespace()
    await resyncTrunkIdentify(existing.trunkId)
}
