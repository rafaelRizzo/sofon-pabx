import { prisma } from '../../lib/prisma'
import { DidsCache } from './cache/dids.cache'
import type { CreateDidInput, UpdateDidInput } from './schemas/did.schema'
import { InboundRouteRepository } from '../../asterisk/inboundroute.repository'
import { InboundRoutesCache } from '../inbound-routes/cache/inbound-routes.cache'
import { AppError } from '../../utils/errors/app.error'

const select = {
    id: true,
    number: true,
    companyId: true,
    createdAt: true,
    updatedAt: true,
}

export const getAllDids = async (companyIds?: string[]) => {
    if (companyIds && companyIds.length === 0) return []

    if (!companyIds) {
        const cached = await DidsCache.getAll()
        if (cached) return cached
    }

    const dids = await prisma.did.findMany({
        where: companyIds ? { companyId: { in: companyIds } } : undefined,
        select,
    })

    if (!companyIds) await DidsCache.setAll(dids)
    return dids
}

export const getDidsByCompany = async (companyId: string) => {
    const cached = await DidsCache.getDidsByCompany(companyId)
    if (cached) return cached

    const company = await prisma.company.findUnique({ where: { id: companyId } })
    if (!company) throw new AppError('Company not found', 404)

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
    const company = await prisma.company.findUnique({ where: { id: data.companyId } })
    if (!company) throw new AppError('Company not found', 404)

    const existing = await prisma.did.findUnique({
        where: { number_companyId: { number: data.number, companyId: data.companyId } },
    })
    if (existing) throw new AppError('DID already exists for this company', 409)

    const did = await prisma.did.create({ data, select })

    await DidsCache.invalidateDidsByCompany(data.companyId)
    await DidsCache.invalidateAll()
    return did
}

export const updateDid = async (id: string, data: UpdateDidInput) => {
    const existing = await prisma.did.findUnique({ where: { id } })
    if (!existing) throw new AppError('DID not found', 404)

    if (data.number) {
        const conflict = await prisma.did.findUnique({
            where: { number_companyId: { number: data.number, companyId: existing.companyId } },
        })
        if (conflict && conflict.id !== id) throw new AppError('DID already exists for this company', 409)
    }

    const did = await prisma.did.update({ where: { id }, data, select })

    await DidsCache.invalidateDid(id)
    await DidsCache.invalidateDidsByCompany(existing.companyId)
    await DidsCache.invalidateAll()
    return did
}

export const deleteDid = async (id: string) => {
    const existing = await prisma.did.findUnique({ where: { id } })
    if (!existing) throw new AppError('DID not found', 404)

    const inboundRoutes = await prisma.inboundRoute.findMany({
        where: { didId: id },
        select: { id: true, trunkId: true },
    })

    await prisma.$transaction(async (tx) => {
        for (const ir of inboundRoutes) {
            await InboundRouteRepository.delete(tx, ir.trunkId, existing.number)
        }
        await tx.did.delete({ where: { id } })
    })

    for (const ir of inboundRoutes) {
        await InboundRoutesCache.invalidateRoute(ir.id)
    }
    await InboundRoutesCache.invalidateByCompany(existing.companyId)
    await DidsCache.invalidateDid(id)
    await DidsCache.invalidateDidsByCompany(existing.companyId)
    await DidsCache.invalidateAll()
}
