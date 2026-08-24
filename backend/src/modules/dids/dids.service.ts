import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { DidsCache } from './cache/dids.cache'
import type { CreateDidInput, UpdateDidInput } from './schemas/did.schema'
import { InboundRouteRepository } from '../../asterisk/inboundroute.repository'
import { FlowEdgeRepository } from '../../asterisk/flow-edge.repository'
import type { InboundDest } from '../inbound-routes/schemas/inbound-route.schema'
import { InboundRoutesCache } from '../inbound-routes/cache/inbound-routes.cache'
import { AppError } from '../../utils/errors/app.error'

const select = {
    id: true,
    number: true,
    companyId: true,
    status: true,
    createdAt: true,
    updatedAt: true,
}

export const getAllDids = async (companyIds?: string[], userId?: string) => {
    if (companyIds && companyIds.length === 0) return []

    if (!companyIds) {
        const cached = await DidsCache.getAll()
        if (cached) return cached
    } else if (userId) {
        const cached = await DidsCache.getForScope(userId)
        if (cached) return cached
    }

    const dids = await prisma.did.findMany({
        where: companyIds ? { companyId: { in: companyIds } } : undefined,
        select,
    })

    if (!companyIds) await DidsCache.setAll(dids)
    else if (userId) await DidsCache.setForScope(userId, dids)
    return dids
}

export const getDidsByCompany = async (companyId: string) => {
    const cached = await DidsCache.getDidsByCompany(companyId)
    if (cached) return cached

    await getCompanyById(companyId)

    const dids = await prisma.did.findMany({ where: { companyId }, select })

    await DidsCache.setDidsByCompany(companyId, dids)
    return dids
}

export const getDidById = async (id: string) => {
    const cached = await DidsCache.getDid(id)
    if (cached) return cached

    const did = await prisma.did.findUnique({ where: { id }, select })
    if (!did) throw new AppError('DID not found', 404)

    await DidsCache.setDid(id, did)
    return did
}

export const createDid = async (data: CreateDidInput) => {
    await getCompanyById(data.companyId)

    const existing = await prisma.did.findUnique({
        where: { number_companyId: { number: data.number, companyId: data.companyId } },
    })
    if (existing) throw new AppError('DID already exists for this company', 409)

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

    if (isReassign) await getCompanyById(data.companyId!)

    if (data.number || isReassign) {
        const conflict = await prisma.did.findUnique({
            where: { number_companyId: { number: data.number ?? existing.number, companyId: targetCompanyId } },
        })
        if (conflict && conflict.id !== id) throw new AppError('DID already exists for this company', 409)
    }

    if (isReassign) {
        const inboundRoutes = await prisma.inboundRoute.findMany({
            where: { didId: id },
            select: { id: true, trunkId: true },
        })

        const did = await prisma.$transaction(async (tx) => {
            for (const ir of inboundRoutes) {
                await InboundRouteRepository.delete(tx, ir.trunkId, existing.number)
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
            await InboundRouteRepository.delete(tx, ir.trunkId, oldRoutingKey)
            await InboundRouteRepository.create(tx, ir.trunkId, newRoutingKey, dest, ir.trunk.maxInChannels)
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

    const inboundRoutes = await prisma.inboundRoute.findMany({
        where: { didId: id },
        select: { id: true, trunkId: true },
    })

    const routingKey = existing.number

    await prisma.$transaction(async (tx) => {
        for (const ir of inboundRoutes) {
            await InboundRouteRepository.delete(tx, ir.trunkId, routingKey)
        }
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
