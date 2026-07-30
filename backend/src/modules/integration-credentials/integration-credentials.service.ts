import { prisma } from '../../lib/prisma'
import { encryptForCompany } from '../../lib/crypto'
import { getCompanyById } from '../companies/companies.service'
import { IntegrationCredentialsCache } from './cache/integration-credentials.cache'
import { AppError } from '../../utils/errors/app.error'
import type { CreateIntegrationCredentialInput, UpdateIntegrationCredentialInput } from './schemas/integration-credential.schema'

const select = {
    id: true,
    provider: true,
    name: true,
    companyId: true,
    baseUrl: true,
    createdAt: true,
    updatedAt: true,
} as const

export const getIntegrationCredentialsByCompany = async (companyId: string, provider?: string) => {
    const cacheKey = provider ? `${companyId}:${provider}` : companyId
    const cached = await IntegrationCredentialsCache.getByCompany(cacheKey)
    if (cached) return cached as any[]

    await getCompanyById(companyId)
    const rows = await prisma.integrationCredential.findMany({ where: { companyId, provider }, select, orderBy: { name: 'asc' } })
    await IntegrationCredentialsCache.setByCompany(cacheKey, rows)
    return rows
}

export const getIntegrationCredentialById = async (id: string) => {
    const credential = await prisma.integrationCredential.findUnique({ where: { id }, select })
    if (!credential) throw new AppError('Integration credential not found', 404)
    return credential
}

export const createIntegrationCredential = async (data: CreateIntegrationCredentialInput) => {
    await getCompanyById(data.companyId)

    const existing = await prisma.integrationCredential.findUnique({
        where: { provider_name_companyId: { provider: data.provider, name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Integration credential already exists for this company', 409)

    const { ciphertext, iv, tag } = encryptForCompany(data.companyId, data.token)
    const credential = await prisma.integrationCredential.create({
        data: {
            provider: data.provider,
            name: data.name,
            companyId: data.companyId,
            baseUrl: data.baseUrl,
            tokenCiphertext: ciphertext,
            tokenIv: iv,
            tokenTag: tag,
        },
        select,
    })

    await IntegrationCredentialsCache.invalidateByCompany(data.companyId)
    return credential
}

export const updateIntegrationCredential = async (id: string, data: UpdateIntegrationCredentialInput) => {
    const existing = await prisma.integrationCredential.findUnique({ where: { id } })
    if (!existing) throw new AppError('Integration credential not found', 404)

    if (data.name && data.name !== existing.name) {
        const conflict = await prisma.integrationCredential.findUnique({
            where: { provider_name_companyId: { provider: existing.provider, name: data.name, companyId: existing.companyId } },
        })
        if (conflict) throw new AppError('Integration credential already exists for this company', 409)
    }

    const tokenFields = data.token !== undefined ? encryptForCompany(existing.companyId, data.token) : null
    const credential = await prisma.integrationCredential.update({
        where: { id },
        data: {
            name: data.name,
            baseUrl: data.baseUrl,
            tokenCiphertext: tokenFields?.ciphertext,
            tokenIv: tokenFields?.iv,
            tokenTag: tokenFields?.tag,
        },
        select,
    })

    await IntegrationCredentialsCache.invalidateByCompany(existing.companyId)
    return credential
}

export const deleteIntegrationCredential = async (id: string) => {
    const existing = await prisma.integrationCredential.findUnique({ where: { id } })
    if (!existing) throw new AppError('Integration credential not found', 404)

    const inUse = await prisma.ixcNode.count({ where: { credentialId: id } })
    if (inUse > 0) throw new AppError(`Still used by ${inUse} node(s) — update or remove those nodes first`, 409)

    await prisma.integrationCredential.delete({ where: { id } })
    await IntegrationCredentialsCache.invalidateByCompany(existing.companyId)
}
