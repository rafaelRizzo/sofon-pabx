import { prisma } from '../../lib/prisma'
import { InboundRoutesCache } from './cache/inbound-routes.cache'
import { InboundRouteRepository } from '../../asterisk/inboundroute.repository'
import type { CreateInboundRouteInput, UpdateInboundRouteInput, InboundDest } from './schemas/inbound-route.schema'
import { AppError } from '../../utils/errors/app.error'

const inboundRouteSelect = {
    id:          true,
    name:        true,
    companyId:   true,
    didId:       true,
    trunkId:     true,
    did:         { select: { id: true, number: true } },
    trunk:       { select: { id: true, name: true } },
    destination: true,
    createdAt:   true,
    updatedAt:   true,
} as const

const _byId = () => prisma.inboundRoute.findUnique({ where: { id: '' }, select: inboundRouteSelect })
export type InboundRouteDto = NonNullable<Awaited<ReturnType<typeof _byId>>>

async function validateDestination(dest: InboundDest | undefined | null, companyId: string) {
    if (!dest || dest.type === 'hangup') return

    switch (dest.type) {
        case 'extension': {
            const ext = await prisma.extension.findUnique({ where: { id: dest.id }, select: { companyId: true } })
            if (!ext) throw new AppError('Extension not found', 404)
            if (ext.companyId !== companyId) throw new AppError('Extension belongs to different company', 403)
            break
        }
        case 'queue': {
            const q = await prisma.queue.findUnique({ where: { id: dest.id }, select: { companyId: true, number: true } })
            if (!q) throw new AppError('Queue not found', 404)
            if (q.companyId !== companyId) throw new AppError('Queue belongs to different company', 403)
            if (!q.number) throw new AppError('Queue has no number — cannot use as inbound destination', 400)
            break
        }
        case 'voicemail':
            break
        case 'timecondition': {
            const tc = await prisma.timeCondition.findUnique({ where: { id: dest.id }, select: { companyId: true } })
            if (!tc) throw new AppError('Time condition not found', 404)
            if (tc.companyId !== companyId) throw new AppError('Time condition belongs to different company', 403)
            break
        }
    }
}

export const getInboundRoutesByCompany = async (companyId: string) => {
    const cached = await InboundRoutesCache.getByCompany(companyId)
    if (cached) return cached

    const company = await prisma.company.findUnique({ where: { id: companyId } })
    if (!company) throw new AppError('Company not found', 404)

    const routes = await prisma.inboundRoute.findMany({ where: { companyId }, select: inboundRouteSelect })
    await InboundRoutesCache.setByCompany(companyId, routes)
    return routes
}

export const getInboundRouteById = async (id: string): Promise<InboundRouteDto> => {
    const cached = await InboundRoutesCache.getRoute(id)
    if (cached) return cached as InboundRouteDto

    const route = await prisma.inboundRoute.findUnique({ where: { id }, select: inboundRouteSelect })
    if (!route) throw new AppError('Inbound route not found', 404)

    await InboundRoutesCache.setRoute(id, route)
    return route
}

export const createInboundRoute = async (data: CreateInboundRouteInput) => {
    const [company, did, trunk] = await Promise.all([
        prisma.company.findUnique({ where: { id: data.companyId } }),
        prisma.did.findUnique({ where: { id: data.didId }, select: { id: true, number: true, companyId: true } }),
        prisma.trunk.findUnique({ where: { id: data.trunkId }, select: { id: true, companyId: true } }),
    ])

    if (!company) throw new AppError('Company not found', 404)
    if (!did) throw new AppError('DID not found', 404)
    if (!trunk) throw new AppError('Trunk not found', 404)
    if (did.companyId !== data.companyId) throw new AppError('DID belongs to different company', 403)
    if (trunk.companyId !== data.companyId) throw new AppError('Trunk belongs to different company', 403)

    const existing = await prisma.inboundRoute.findUnique({
        where: { trunkId_didId: { trunkId: data.trunkId, didId: data.didId } },
    })
    if (existing) throw new AppError('Inbound route already exists for this trunk + DID combination', 409)

    await validateDestination(data.destination ?? null, data.companyId)

    const route = await prisma.$transaction(async (tx) => {
        const created = await tx.inboundRoute.create({
            data: {
                name:        data.name,
                companyId:   data.companyId,
                didId:       data.didId,
                trunkId:     data.trunkId,
                destination: data.destination ?? undefined,
            },
            select: inboundRouteSelect,
        })

        await InboundRouteRepository.create(tx, data.trunkId, did.number, data.destination ?? null)
        return created
    })

    await InboundRoutesCache.invalidateByCompany(data.companyId)
    return route
}

export const updateInboundRoute = async (id: string, data: UpdateInboundRouteInput) => {
    const existing = await prisma.inboundRoute.findUnique({
        where: { id },
        include: { did: { select: { number: true } } },
    })
    if (!existing) throw new AppError('Inbound route not found', 404)

    if (data.destination !== undefined) {
        await validateDestination(data.destination, existing.companyId)
    }

    const newDest = data.destination !== undefined ? data.destination : (existing.destination as InboundDest)

    const route = await prisma.$transaction(async (tx) => {
        const updated = await tx.inboundRoute.update({
            where: { id },
            data: {
                name:        data.name,
                destination: data.destination === undefined ? undefined : (data.destination ?? null),
            },
            select: inboundRouteSelect,
        })

        await InboundRouteRepository.update(tx, existing.trunkId, existing.did.number, newDest)
        return updated
    })

    await InboundRoutesCache.invalidateRoute(id)
    await InboundRoutesCache.invalidateByCompany(existing.companyId)
    return route
}

export const deleteInboundRoute = async (id: string) => {
    const existing = await prisma.inboundRoute.findUnique({
        where: { id },
        include: { did: { select: { number: true } } },
    })
    if (!existing) throw new AppError('Inbound route not found', 404)

    await prisma.$transaction(async (tx) => {
        await InboundRouteRepository.delete(tx, existing.trunkId, existing.did.number)
        await tx.inboundRoute.delete({ where: { id } })
    })

    await InboundRoutesCache.invalidateRoute(id)
    await InboundRoutesCache.invalidateByCompany(existing.companyId)
}
