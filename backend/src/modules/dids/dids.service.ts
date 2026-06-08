import { prisma } from '../../lib/prisma'
import { DidsCache } from './cache/dids.cache'
import type { CreateDidInput, UpdateDidInput } from './schemas/did.schema'
import { AppError } from '../../utils/errors/app.error'

const select = {
    id: true,
    number: true,
    companyId: true,
    createdAt: true,
    updatedAt: true,
}

export const getAllDids = async () => {
    return prisma.did.findMany({ select })
}

export const getDidsByCompany = async (companyId: string) => {
    const company = await prisma.company.findUnique({ where: { id: companyId } })
    if (!company) throw new AppError('Company not found', 404)

    const cached = await DidsCache.getDidsByCompany(companyId)
    if (cached) return cached

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
    return did
}

export const deleteDid = async (id: string) => {
    const existing = await prisma.did.findUnique({ where: { id } })
    if (!existing) throw new AppError('DID not found', 404)

    await prisma.did.delete({ where: { id } })

    await DidsCache.invalidateDid(id)
    await DidsCache.invalidateDidsByCompany(existing.companyId)
}
