import { Prisma } from '../../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { InboundRoutesCache } from './cache/inbound-routes.cache'
import { InboundRouteRepository } from '../../asterisk/inboundroute.repository'
import { validateRouteDestination } from '../../schemas/route-destination.validate'
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
    destination: true,
    createdAt: true,
    updatedAt: true,
} as const

const _byId = () => prisma.inboundRoute.findUnique({ where: { id: '' }, select: inboundRouteSelect })
export type InboundRouteDto = NonNullable<Awaited<ReturnType<typeof _byId>>>

const validateDestination = (dest: InboundDest | undefined | null, companyId: string) =>
    validateRouteDestination(dest ?? null, companyId)

export const getInboundRoutesByCompany = async (companyId: string) => {
    const cached = await InboundRoutesCache.getByCompany(companyId)
    if (cached) return cached

    await getCompanyById(companyId)

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
    const [, did, trunk] = await Promise.all([
        getCompanyById(data.companyId),
        prisma.did.findUnique({ where: { id: data.didId }, select: { id: true, number: true, companyId: true } }),
        prisma.trunk.findUnique({ where: { id: data.trunkId }, select: { id: true, companyId: true, maxInChannels: true } }),
    ])

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
                name: data.name,
                companyId: data.companyId,
                didId: data.didId,
                trunkId: data.trunkId,
                destination: data.destination ?? undefined,
            },
            select: inboundRouteSelect,
        })

        await InboundRouteRepository.create(tx, data.trunkId, did.number, data.destination ?? null, trunk.maxInChannels)
        return created
    })

    await InboundRoutesCache.invalidateByCompany(data.companyId)
    return route
}

export const updateInboundRoute = async (id: string, data: UpdateInboundRouteInput) => {
    const existing = await prisma.inboundRoute.findUnique({
        where: { id },
        include: {
            did: { select: { number: true } },
            trunk: { select: { maxInChannels: true } },
        },
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
                name: data.name,
                destination: data.destination === undefined ? undefined : (data.destination ?? Prisma.JsonNull),
            },
            select: inboundRouteSelect,
        })

        await InboundRouteRepository.update(tx, existing.trunkId, existing.did.number, newDest, existing.trunk.maxInChannels)
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
