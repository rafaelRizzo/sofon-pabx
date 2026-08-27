import { prisma } from '../../../lib/prisma'
import { getCompanyById } from '../../companies/companies.service'
import { getExtensionDto } from '../../extensions/extensions.service'
import { AgentScopesCache } from './cache/agent-scope.cache'
import type { CreateAgentScopeInput, UpdateAgentScopeInput } from './schemas/agent-scope.schema'
import { AppError } from '../../../utils/errors/app.error'

const scopeSelect = {
    id: true,
    extensionId: true,
    companyId: true,
    active: true,
    createdAt: true,
    updatedAt: true,
} as const

export const getScopesByCompany = async (companyId: string) => {
    const cached = await AgentScopesCache.getByCompany(companyId)
    if (cached) return cached

    await getCompanyById(companyId)

    const scopes = await prisma.agentCompanyScope.findMany({ where: { companyId }, select: scopeSelect })
    await AgentScopesCache.setByCompany(companyId, scopes)
    return scopes
}

export const createScope = async (data: CreateAgentScopeInput) => {
    await getCompanyById(data.companyId)
    await getExtensionDto(data.extensionId)

    const existing = await prisma.agentCompanyScope.findUnique({
        where: { extensionId_companyId: { extensionId: data.extensionId, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Extension already has a scope for this company', 409)

    const scope = await prisma.agentCompanyScope.create({ data, select: scopeSelect })
    await AgentScopesCache.invalidateByCompany(data.companyId)
    return scope
}

export const updateScope = async (id: string, data: UpdateAgentScopeInput) => {
    const existing = await prisma.agentCompanyScope.findUnique({ where: { id } })
    if (!existing) throw new AppError('Agent scope not found', 404)

    const scope = await prisma.agentCompanyScope.update({ where: { id }, data, select: scopeSelect })
    await AgentScopesCache.invalidateByCompany(existing.companyId)
    return scope
}

// Gate opt-in por empresa: só passa a exigir AgentCompanyScope se a empresa já tiver pelo menos 1
// scope cadastrado (indica que ela adotou a feature) - empresa sem nenhum scope continua sem
// restrição, 100% retrocompatível com quem já usa QueueMember sem elegibilidade. Usado por
// QueueMembersService.addMember antes de vincular a extensão à fila.
export const assertAgentEligible = async (extensionId: string, companyId: string) => {
    const anyScopeForCompany = await prisma.agentCompanyScope.findFirst({ where: { companyId }, select: { id: true } })
    if (!anyScopeForCompany) return

    const scope = await prisma.agentCompanyScope.findUnique({
        where: { extensionId_companyId: { extensionId, companyId } },
    })
    if (!scope?.active) throw new AppError('Extension is not eligible to serve this company', 403)
}

export const deleteScope = async (id: string) => {
    const existing = await prisma.agentCompanyScope.findUnique({ where: { id } })
    if (!existing) throw new AppError('Agent scope not found', 404)

    await prisma.agentCompanyScope.delete({ where: { id } })
    await AgentScopesCache.invalidateByCompany(existing.companyId)
}
