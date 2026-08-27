import { prisma } from '../../lib/prisma'
import { cacheManager } from '../../config/cache'

export const isAdmin = (role: string) => role === 'admin'

const SCOPE_NAMESPACE = 'scope:companyIds'

// Resolve o escopo (empresas do usuário) em toda rota protegida - cacheado pois roda em TODA
// requisição de usuário não-admin, mesmo quando o endpoint em si não bate no banco
export const getUserCompanyIds = async (userId: string): Promise<string[]> => {
    const cached = await cacheManager.get<string[]>(SCOPE_NAMESPACE, userId)
    if (cached) return cached

    const rows = await prisma.userCompany.findMany({
        where: { userId },
        select: { companyId: true },
    })
    const companyIds = rows.map((r) => r.companyId)
    await cacheManager.set(SCOPE_NAMESPACE, userId, companyIds)
    return companyIds
}

export const invalidateUserCompanyIds = async (userId: string) => {
    await cacheManager.invalidateByKey(`${SCOPE_NAMESPACE}:${userId}`)
}

const PERMISSIONS_NAMESPACE = 'scope:permissions'

// Mesma lógica de cache de getUserCompanyIds; checado em toda rota gateada por requirePermission
export const getUserPermissions = async (userId: string): Promise<string[]> => {
    const cached = await cacheManager.get<string[]>(PERMISSIONS_NAMESPACE, userId)
    if (cached) return cached

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { permissions: true } })
    const permissions = user?.permissions ?? []
    await cacheManager.set(PERMISSIONS_NAMESPACE, userId, permissions)
    return permissions
}

export const invalidateUserPermissions = async (userId: string) => {
    await cacheManager.invalidateByKey(`${PERMISSIONS_NAMESPACE}:${userId}`)
}
